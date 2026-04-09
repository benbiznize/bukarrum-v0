import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AnalyticsBooking = {
  id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_price: number;
  status: string;
  resource_id: string;
  resource_name: string;
  location_id: string | null;
  location_name: string | null;
  booker_id: string;
  booker_name: string;
  booker_email: string;
};

/**
 * Fetch bookings with resource/location/booker joins for analytics.
 *
 * Filters by tenant (via resources!inner), date range, and optionally
 * by location or resource.
 */
export async function fetchAnalyticsBookings(
  tenantId: string,
  from: string,
  to: string,
  locationId?: string,
  resourceId?: string
): Promise<AnalyticsBooking[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(
      `
      id,
      start_time,
      end_time,
      duration_hours,
      total_price,
      status,
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
    .eq("resource.tenant_id", tenantId)
    .gte("start_time", from)
    .lt("start_time", to)
    .order("start_time", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  if (resourceId) {
    query = query.eq("resource_id", resourceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchAnalyticsBookings error:", error);
    return [];
  }

  // Flatten nested Supabase response into AnalyticsBooking[]
  return (data ?? []).map((row) => {
    const resource = row.resource as unknown as {
      id: string;
      name: string;
      tenant_id: string;
    };
    const location = row.location as unknown as {
      id: string;
      name: string;
    } | null;
    const booker = row.booker as unknown as {
      id: string;
      name: string;
      email: string;
    };

    return {
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_hours: row.duration_hours,
      total_price: row.total_price,
      status: row.status,
      resource_id: resource.id,
      resource_name: resource.name,
      location_id: location?.id ?? null,
      location_name: location?.name ?? null,
      booker_id: booker.id,
      booker_name: booker.name,
      booker_email: booker.email,
    };
  });
}

/**
 * Fetch availability rows for all resources belonging to a tenant.
 */
export async function fetchAvailability(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability")
    .select(
      `
      id,
      resource_id,
      day_of_week,
      start_time,
      end_time,
      resource:resources!inner(
        tenant_id
      )
    `
    )
    .eq("resource.tenant_id", tenantId);

  if (error) {
    console.error("fetchAvailability error:", error);
    return [];
  }

  return data ?? [];
}
