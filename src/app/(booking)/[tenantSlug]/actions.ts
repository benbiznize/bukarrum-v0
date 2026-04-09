"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";
import {
  sendBookingConfirmation,
  sendNewBookingNotification,
} from "@/lib/resend/emails";

type DayOfWeek = Database["public"]["Enums"]["day_of_week"];

export async function getResourcesForLocation(locationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("resource_locations")
    .select("resource:resources!inner(id, name, description, type, hourly_rate, min_duration_hours, max_duration_hours, image_url)")
    .eq("location_id", locationId)
    .eq("resource.is_active", true);

  if (error) return [];

  return data.map((row) => row.resource).filter(Boolean);
}

export async function getAvailableDates(
  resourceId: string,
  timezone: string
) {
  const supabase = await createClient();

  // Get which days of the week this resource is available
  const { data: availability } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("resource_id", resourceId);

  if (!availability || availability.length === 0) return [];

  const availableDays = new Set(availability.map((a) => a.day_of_week));

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // Generate dates for the next 30 days
  const dates: string[] = [];
  const now = new Date();

  for (let i = 0; i <= 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    // Get the day name in the location's timezone
    const dayName = date
      .toLocaleDateString("en-US", { weekday: "long", timeZone: timezone })
      .toLowerCase();

    if (availableDays.has(dayName as DayOfWeek)) {
      // Format as YYYY-MM-DD in the location timezone
      const dateStr = date.toLocaleDateString("sv-SE", { timeZone: timezone });
      dates.push(dateStr);
    }
  }

  return dates;
}

export async function getTimeSlots(
  resourceId: string,
  date: string,
  timezone: string
) {
  const supabase = await createClient();

  // Get day of week for the selected date
  const dateObj = new Date(date + "T12:00:00");
  const dayName = dateObj
    .toLocaleDateString("en-US", { weekday: "long", timeZone: timezone })
    .toLowerCase();

  // Get availability windows for this day
  const { data: availability } = await supabase
    .from("availability")
    .select("start_time, end_time")
    .eq("resource_id", resourceId)
    .eq("day_of_week", dayName as DayOfWeek);

  if (!availability || availability.length === 0) return [];

  // Adjust to UTC using timezone offset
  const startISO = toTimestampTZ(date, "00:00", timezone);
  const endISO = toTimestampTZ(date, "23:59", timezone);

  const { data: existingBookings } = await supabase.rpc(
    "get_bookings_for_resource",
    {
      p_resource_id: resourceId,
      p_start: startISO,
      p_end: endISO,
    }
  );

  const bookings = (existingBookings || []).map((b: { start_time: string; end_time: string }) => ({
    start: new Date(b.start_time),
    end: new Date(b.end_time),
  }));

  // Generate 1-hour slots from availability windows
  const slots: { startTime: string; availableUntil: string }[] = [];

  for (const window of availability) {
    const [startH] = window.start_time.split(":").map(Number);
    const [endH] = window.end_time.split(":").map(Number);

    for (let h = startH; h < endH; h++) {
      const slotStart = `${String(h).padStart(2, "0")}:00`;
      const slotStartDate = new Date(
        toTimestampTZ(date, slotStart, timezone)
      );

      // Check if this slot conflicts with an existing booking
      const isBooked = bookings.some(
        (b: { start: Date; end: Date }) =>
          slotStartDate >= b.start && slotStartDate < b.end
      );

      if (isBooked) continue;

      // Determine how far this slot can extend (until next booking or window end)
      let availableUntilH = endH;
      for (const b of bookings) {
        const bookingStartH = getHourInTimezone(b.start, timezone);
        if (bookingStartH > h && bookingStartH < availableUntilH) {
          availableUntilH = bookingStartH;
        }
      }

      slots.push({
        startTime: slotStart,
        availableUntil: `${String(availableUntilH).padStart(2, "0")}:00`,
      });
    }
  }

  // Filter out past slots if date is today
  const nowInTZ = new Date().toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  const todayInTZ = new Date().toLocaleDateString("sv-SE", { timeZone: timezone });

  if (date === todayInTZ) {
    return slots.filter((s) => s.startTime > nowInTZ);
  }

  return slots;
}

export async function createBooking(formData: FormData) {
  const resourceId = formData.get("resourceId") as string;
  const locationId = formData.get("locationId") as string;
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const durationHours = Number(formData.get("durationHours"));
  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const timezone = formData.get("timezone") as string;

  if (!resourceId || !locationId || !date || !startTime || !durationHours || !name || !email) {
    return { error: "Faltan datos requeridos" };
  }

  const supabase = await createClient();

  // Fetch the resource to get the authoritative hourly rate
  const { data: resource } = await supabase
    .from("resources")
    .select("hourly_rate")
    .eq("id", resourceId)
    .single();

  if (!resource) return { error: "Recurso no encontrado" };

  const totalPrice = resource.hourly_rate * durationHours;

  // Compute timestamps
  const startISO = toTimestampTZ(date, startTime, timezone);
  const [startH] = startTime.split(":").map(Number);
  const endTime = `${String(startH + durationHours).padStart(2, "0")}:00`;
  const endISO = toTimestampTZ(date, endTime, timezone);

  // Upsert booker
  const { data: bookerId, error: bookerError } = await supabase.rpc(
    "upsert_booker",
    { p_email: email, p_name: name, p_phone: phone ?? undefined }
  );

  if (bookerError) return { error: "Error al registrar datos de contacto" };

  // Create booking atomically with overlap check
  const { data: bookingId, error: bookingError } = await supabase.rpc(
    "create_booking_if_available",
    {
      p_resource_id: resourceId,
      p_location_id: locationId,
      p_booker_id: bookerId,
      p_start_time: startISO,
      p_end_time: endISO,
      p_duration_hours: durationHours,
      p_total_price: totalPrice,
    }
  );

  if (bookingError) {
    if (bookingError.message?.includes("BOOKING_CONFLICT")) {
      return { error: "BOOKING_CONFLICT" };
    }
    return { error: "Error al crear la reserva" };
  }

  // Send emails (fire-and-forget — don't block the response)
  const { data: resourceData } = await supabase
    .from("resources")
    .select("name, tenant:tenants(name, user_id)")
    .eq("id", resourceId)
    .single();

  const { data: locationData } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .single();

  if (resourceData?.tenant && locationData) {
    const tenant = resourceData.tenant as unknown as {
      name: string;
      user_id: string;
    };

    // Get tenant owner email via service role (anon client can't access auth.admin)
    const serviceClient = createServiceClient();
    const { data: tenantUser } = await serviceClient.auth.admin
      .getUserById(tenant.user_id)
      .catch(() => ({ data: { user: null } }));

    const dateDisplay = new Date(date + "T12:00:00").toLocaleDateString(
      "es-CL",
      { weekday: "long", day: "numeric", month: "long" }
    );

    const emailData = {
      bookerName: name,
      bookerEmail: email,
      tenantName: tenant.name,
      tenantEmail: tenantUser?.user?.email ?? "",
      locationName: locationData.name,
      resourceName: resourceData.name,
      date: dateDisplay,
      startTime,
      durationHours,
      totalPrice,
    };

    sendBookingConfirmation(emailData);
    if (emailData.tenantEmail) {
      sendNewBookingNotification(emailData);
    }
  }

  return { error: "", bookingId };
}

/** Extract the hour (0-23) of a Date in a given timezone. */
function getHourInTimezone(date: Date, timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date)
  );
}

/** Convert a date + time in a given timezone to an ISO timestamptz string. */
function toTimestampTZ(date: string, time: string, timezone: string): string {
  // Create a date in UTC, then adjust
  const dtStr = `${date}T${time}:00`;
  // Use Intl to find the UTC offset for this timezone at this date/time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  });
  const tempDate = new Date(dtStr + "Z");
  const parts = formatter.formatToParts(tempDate);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // Parse offset like "GMT-04:00" or "GMT+05:30"
  const offsetMatch = tzPart?.value?.match(/GMT([+-]\d{2}):?(\d{2})?/);

  if (!offsetMatch) {
    // Fallback: use the date string as-is, letting Postgres interpret it
    return dtStr;
  }

  const offsetH = parseInt(offsetMatch[1]);
  const offsetM = parseInt(offsetMatch[2] || "0");
  const totalOffsetMinutes = offsetH * 60 + (offsetH < 0 ? -offsetM : offsetM);

  // Subtract offset to get UTC (parse as UTC to avoid system-timezone interference)
  const localDate = new Date(dtStr + "Z");
  localDate.setMinutes(localDate.getMinutes() - totalOffsetMinutes);

  return localDate.toISOString();
}
