import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/database.types";

type ResourceType = Database["public"]["Enums"]["resource_type"];

export type BookingPageLocation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  timezone: string;
  image_url: string | null;
};

export type BookingPageResource = {
  id: string;
  name: string;
  description: string | null;
  type: ResourceType;
  hourly_rate: number;
  min_duration_hours: number;
  max_duration_hours: number;
  image_url: string | null;
};

export type BookingPageData = {
  tenant: { id: string; name: string };
  readyLocations: BookingPageLocation[];
  /** Prefetched when there's exactly one location, so StepResource can
   *  hydrate without a client round-trip (LCP optimization). */
  initialResources: BookingPageResource[] | null;
};

/**
 * Plain (uncached) implementation. Kept separate so the cached wrapper
 * is the only thing that touches `unstable_cache`.
 */
async function fetchBookingPageData(
  tenantSlug: string
): Promise<BookingPageData | null> {
  const supabase = createPublicClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) return null;

  const { data: locationRows } = await supabase
    .from("locations")
    .select("id, name, address, city, timezone, image_url")
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .order("name");

  const locations = locationRows ?? [];

  if (locations.length === 0) {
    return { tenant, readyLocations: [], initialResources: null };
  }

  const { data: rlRows } = await supabase
    .from("resource_locations")
    .select("location_id")
    .in(
      "location_id",
      locations.map((l) => l.id)
    );

  const locationsWithResources = new Set(
    (rlRows ?? []).map((r) => r.location_id)
  );
  const readyLocations = locations.filter((l) =>
    locationsWithResources.has(l.id)
  );

  // Prefetch resources when there's only one location (skipLocation flow).
  // This is the LCP path: StepResource renders first and its first image
  // needs to be in the initial HTML.
  let initialResources: BookingPageResource[] | null = null;
  if (readyLocations.length === 1) {
    const { data: resRows } = await supabase
      .from("resource_locations")
      .select(
        "resource:resources!inner(id, name, description, type, hourly_rate, min_duration_hours, max_duration_hours, image_url)"
      )
      .eq("location_id", readyLocations[0].id)
      .eq("resource.is_active", true);

    initialResources = (resRows ?? [])
      .map((row) => row.resource)
      .filter((r): r is BookingPageResource => r !== null);
  }

  return { tenant, readyLocations, initialResources };
}

/**
 * Fetches everything the public booking page needs for a tenant.
 *
 * Two layers of caching:
 *   - React `cache()` dedupes calls within a single request (e.g. so that
 *     `generateMetadata` and the page component share one result).
 *   - `unstable_cache` persists across requests, tagged per-slug so that
 *     mutations can invalidate it via `revalidateBookingPage`.
 *
 * Returns `null` when the tenant doesn't exist.
 */
export const getBookingPageData = cache(
  (tenantSlug: string): Promise<BookingPageData | null> => {
    return unstable_cache(
      () => fetchBookingPageData(tenantSlug),
      ["booking-page-data", tenantSlug],
      {
        tags: [`booking-page:slug:${tenantSlug}`],
        revalidate: 3600, // 1 hour fallback; mutations also invalidate explicitly
      }
    )();
  }
);

/**
 * Invalidate the cached booking page for a tenant after a mutation.
 *
 * Pass `{ expire: 0 }` so the next request sees fresh data immediately
 * (read-your-own-writes), instead of stale-while-revalidate.
 */
export function revalidateBookingPage(tenantSlug: string) {
  revalidateTag(`booking-page:slug:${tenantSlug}`, { expire: 0 });
}
