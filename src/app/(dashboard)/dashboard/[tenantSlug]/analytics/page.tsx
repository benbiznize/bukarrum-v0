import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { subDays, format, differenceInDays, parseISO } from "date-fns";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { getPlanFeatures } from "@/lib/plans/check-limit";
import { fetchAnalyticsBookings, fetchAvailability } from "@/lib/analytics/queries";
import {
  aggregateRevenueOverTime,
  aggregateRevenueByResource,
  aggregateRevenueByLocation,
  aggregateBookingsByStatus,
  aggregateTopCustomers,
  computeSummaryStats,
} from "@/lib/analytics/aggregations";
import { calculateUtilization } from "@/lib/analytics/utilization";
import { UpgradePrompt } from "@/components/analytics/upgrade-prompt";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { RevenueOverTimeChart } from "@/components/analytics/revenue-over-time-chart";
import { BookingVolumeChart } from "@/components/analytics/booking-volume-chart";
import { RevenueByResourceChart } from "@/components/analytics/revenue-by-resource-chart";
import { RevenueByLocationChart } from "@/components/analytics/revenue-by-location-chart";
import { UtilizationChart } from "@/components/analytics/utilization-chart";
import { TopCustomersTable } from "@/components/analytics/top-customers-table";

export const metadata: Metadata = { title: "Analíticas" };

export default async function AnalyticsPage({
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

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  // Feature gate: check if analytics is available in the tenant's plan
  const plan = await getPlanFeatures(tenant.id);
  if (!plan?.features.analytics) {
    return <UpgradePrompt dict={dict.dashboard} tenantSlug={tenantSlug} />;
  }

  // Parse date range from searchParams
  const today = new Date();
  const fromDate = sp.from
    ? parseISO(sp.from as string)
    : subDays(today, 30);
  const toDate = sp.to ? parseISO(sp.to as string) : today;

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");

  const locationId = (sp.location as string) || undefined;
  const resourceId = (sp.resource as string) || undefined;

  // Determine time interval: if range > 60 days use "week", else "day"
  const rangeDays = differenceInDays(toDate, fromDate);
  const interval: "day" | "week" = rangeDays > 60 ? "week" : "day";

  // Fetch data in parallel.
  //
  // Two separate booking fetches, by design:
  //
  // - `revenueBookings` — filtered by `created_at` (sale date). Feeds every
  //   revenue / volume / customer aggregation so "last 30 days" means
  //   "sales made in the last 30 days," matching Overview's mental model.
  //
  // - `utilizationBookings` — filtered by `start_time` (session date). Feeds
  //   `calculateUtilization`, which compares booked hours against available
  //   hours inside the calendar window — inherently a start_time concept.
  const [
    revenueBookings,
    utilizationBookings,
    availability,
    resourcesResult,
    locationsResult,
  ] = await Promise.all([
    fetchAnalyticsBookings(
      tenant.id,
      fromStr,
      toStr,
      locationId,
      resourceId,
      "created_at"
    ),
    fetchAnalyticsBookings(
      tenant.id,
      fromStr,
      toStr,
      locationId,
      resourceId,
      "start_time"
    ),
    fetchAvailability(tenant.id),
    supabase
      .from("resources")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .order("name"),
  ]);

  const resources = resourcesResult.data ?? [];
  const locations = locationsResult.data ?? [];

  // Revenue / volume / customer aggregations — sales perspective
  const revenueOverTime = aggregateRevenueOverTime(revenueBookings, interval);
  const revenueByResource = aggregateRevenueByResource(revenueBookings);
  const analyticsView = (dict.dashboard as Record<string, unknown>).analyticsView as Record<string, string>;
  const revenueByLocation = aggregateRevenueByLocation(revenueBookings, analyticsView.noLocation);
  const bookingsByStatus = aggregateBookingsByStatus(revenueBookings, interval);
  const topCustomers = aggregateTopCustomers(revenueBookings);
  const summaryStats = computeSummaryStats(revenueBookings);

  // Utilization — calendar / session perspective
  const availabilityRows = (availability ?? []).map((a) => ({
    resource_id: a.resource_id,
    day_of_week: a.day_of_week,
    start_time: a.start_time,
    end_time: a.end_time,
  }));
  const utilization = calculateUtilization(
    resources,
    availabilityRows,
    utilizationBookings,
    fromStr,
    toStr
  );

  // Compute overall utilization rate
  const totalAvailableHours = utilization.reduce(
    (sum, u) => sum + u.availableHours,
    0
  );
  const totalBookedHours = utilization.reduce(
    (sum, u) => sum + u.bookedHours,
    0
  );
  const overallUtilization =
    totalAvailableHours > 0
      ? Math.min((totalBookedHours / totalAvailableHours) * 100, 100)
      : 0;

  const d = dict.dashboard;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{d.analytics}</h1>
      </div>

      <AnalyticsFilters
        locations={locations}
        resources={resources}
        selectedLocation={locationId ?? null}
        selectedResource={resourceId ?? null}
        from={fromDate.toISOString()}
        to={toDate.toISOString()}
        dict={d}
      />

      <SummaryCards
        stats={summaryStats}
        utilizationRate={overallUtilization}
        dict={d}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueOverTimeChart data={revenueOverTime} dict={d} />
        <BookingVolumeChart data={bookingsByStatus} dict={d} />
        <RevenueByResourceChart data={revenueByResource} dict={d} />
        <RevenueByLocationChart data={revenueByLocation} dict={d} />
        <UtilizationChart data={utilization} dict={d} />
        <TopCustomersTable data={topCustomers} dict={d} />
      </div>
    </div>
  );
}
