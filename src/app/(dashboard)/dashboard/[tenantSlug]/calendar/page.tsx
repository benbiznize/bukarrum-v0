import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import { CalendarView } from "@/components/dashboard/calendar/calendar-view";
import type { CalendarBooking } from "@/components/dashboard/calendar/calendar-types";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  // Parse search params
  const view = sp.view === "month" ? "month" : "week";
  const currentDate = sp.date ? parseISO(sp.date as string) : new Date();
  const selectedLocation = (sp.location as string) || null;
  const selectedResource = (sp.resource as string) || null;

  // Compute date range
  const rangeStart =
    view === "week"
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);
  const rangeEnd =
    view === "week"
      ? endOfWeek(currentDate, { weekStartsOn: 1 })
      : endOfMonth(currentDate);

  // Fetch bookings, resources, and locations in parallel
  const [bookingsResult, resourcesResult, locationsResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `
        id,
        start_time,
        end_time,
        duration_hours,
        total_price,
        status,
        notes,
        resource:resources!inner(
          id,
          name,
          tenant_id
        ),
        location:locations(
          id,
          name
        ),
        booker:bookers!inner(
          id,
          name,
          email
        )
      `
      )
      .eq("resource.tenant_id", tenant.id)
      .gte("start_time", rangeStart.toISOString())
      .lt("start_time", rangeEnd.toISOString())
      .order("start_time"),
    supabase
      .from("resources")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("locations")
      .select("id, name, timezone")
      .eq("tenant_id", tenant.id)
      .order("name"),
  ]);

  // Flatten booking data into CalendarBooking type
  const bookings: CalendarBooking[] = (bookingsResult.data ?? []).map((b) => {
    const resource = b.resource as unknown as {
      id: string;
      name: string;
      tenant_id: string;
    };
    const location = b.location as unknown as {
      id: string;
      name: string;
    } | null;
    const booker = b.booker as unknown as {
      id: string;
      name: string;
      email: string;
    };

    return {
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      duration_hours: b.duration_hours,
      total_price: b.total_price,
      status: b.status,
      notes: b.notes,
      resource_id: resource.id,
      resource_name: resource.name,
      location_id: location?.id ?? null,
      location_name: location?.name ?? null,
      booker_name: booker.name,
      booker_email: booker.email,
    };
  });

  const resources = resourcesResult.data ?? [];
  const locations = locationsResult.data ?? [];

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <CalendarView
      bookings={bookings}
      resources={resources}
      locations={locations}
      tenantSlug={tenantSlug}
      currentView={view}
      currentDate={currentDate.toISOString()}
      selectedLocation={selectedLocation}
      selectedResource={selectedResource}
      dict={dict.dashboard}
      locale={locale}
    />
  );
}
