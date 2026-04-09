"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { sendBookingStatusChange } from "@/lib/resend/emails";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

export async function updateBookingStatus(
  tenantSlug: string,
  bookingId: string,
  status: BookingStatus
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Verify the booking belongs to this tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) return { error: "Tenant no encontrado" };

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) {
    return { error: "No se pudo actualizar el estado." };
  }

  // Send status change email to booker (fire-and-forget)
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "start_time, resource:resources(name), location:locations(name, timezone), booker:bookers(name, email)"
    )
    .eq("id", bookingId)
    .single();

  if (booking?.booker && booking?.resource && booking?.location) {
    const booker = booking.booker as unknown as { name: string; email: string };
    const resource = booking.resource as unknown as { name: string };
    const location = booking.location as unknown as {
      name: string;
      timezone: string;
    };

    const startDate = new Date(booking.start_time);
    const dateDisplay = startDate.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: location.timezone,
    });
    const timeDisplay = startDate.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: location.timezone,
    });

    sendBookingStatusChange({
      bookerName: booker.name,
      bookerEmail: booker.email,
      resourceName: resource.name,
      locationName: location.name,
      date: dateDisplay,
      startTime: timeDisplay,
      newStatus: status,
    });
  }

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { error: "" };
}
