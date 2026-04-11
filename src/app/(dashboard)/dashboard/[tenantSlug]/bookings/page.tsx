import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookingsHeader } from "./_components/bookings-header";
import { BookingsOmnibox } from "./_components/bookings-omnibox";
import { BookingsTabs } from "./_components/bookings-tabs";
import { BookingsFilterBar } from "./_components/bookings-filter-bar";
import { BookingsTable } from "./_components/bookings-table";
import { BookingsEmptyState } from "./_components/bookings-empty-state";
import { BookingsPagination } from "./_components/bookings-pagination";
import { BookingsBulkActionBar } from "./_components/bookings-bulk-action-bar";
import { BookingsSelectionProvider } from "./_components/bookings-selection-context";
import { parseSearchParams } from "./_lib/filters";
import {
  buildBookingsQuery,
  buildCountsQuery,
  resolveCounts,
} from "./_lib/queries";
import type { BookingRow } from "./_lib/types";

export const metadata: Metadata = { title: "Reservas" };

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tenantSlug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const filters = parseSearchParams(rawSearchParams);
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

  // Filter-chip options: locations + resources (with their location
  // assignments) so the resource chip can narrow itself when a location is
  // picked.
  const [
    { count: totalCount },
    { data: locations },
    { data: resourceRows },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, resource:resources!inner(tenant_id)", {
        count: "exact",
        head: true,
      })
      .eq("resource.tenant_id", tenant.id),
    supabase
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .order("name"),
    supabase
      .from("resources")
      .select("id, name, resource_locations(location_id)")
      .eq("tenant_id", tenant.id)
      .order("name"),
  ]);

  const locationOptions = locations ?? [];
  const resourceOptions = (resourceRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    location_ids: (r.resource_locations ?? []).map(
      (rl: { location_id: string }) => rl.location_id
    ),
  }));

  // Run the main list query and the counts dict in parallel. The counts
  // dict resolver maps individual rejections to `null`, so a single slow
  // count never takes down the page.
  const now = new Date();
  const [listResult, counts] = await Promise.all([
    buildBookingsQuery(supabase, tenant.id, filters, now),
    resolveCounts(buildCountsQuery(supabase, tenant.id, filters, now)),
  ]);

  const rows = (listResult.data ?? []) as BookingRow[];
  const filteredCount = listResult.count ?? rows.length;

  return (
    <BookingsSelectionProvider>
      <div className="p-6">
        <BookingsHeader
          filteredCount={filteredCount}
          totalCount={totalCount ?? 0}
        />
        <BookingsOmnibox />
        <BookingsTabs counts={counts} />
        <BookingsFilterBar
          locations={locationOptions}
          resources={resourceOptions}
        />
        <BookingsBulkActionBar tenantSlug={tenantSlug} />

        {rows.length > 0 ? (
          <>
            <BookingsTable rows={rows} tenantSlug={tenantSlug} />
            <BookingsPagination total={filteredCount} />
          </>
        ) : (
          <BookingsEmptyState searchQuery={filters.q} />
        )}
      </div>
    </BookingsSelectionProvider>
  );
}
