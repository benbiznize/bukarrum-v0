import { format, parseISO, startOfWeek } from "date-fns";
import type { AnalyticsBooking } from "./queries";

// ---------------------------------------------------------------------------
// Revenue over time
// ---------------------------------------------------------------------------

export type RevenueOverTimePoint = {
  date: string;
  revenue: number;
};

/**
 * Group non-cancelled bookings by day or week and sum revenue.
 */
export function aggregateRevenueOverTime(
  bookings: AnalyticsBooking[],
  interval: "day" | "week"
): RevenueOverTimePoint[] {
  const map = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === "cancelled") continue;

    const parsed = parseISO(b.start_time);
    const key =
      interval === "day"
        ? format(parsed, "yyyy-MM-dd")
        : format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd");

    map.set(key, (map.get(key) ?? 0) + b.total_price);
  }

  return Array.from(map.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Revenue by resource
// ---------------------------------------------------------------------------

export type RevenueByResource = {
  name: string;
  revenue: number;
};

/**
 * Sum revenue per resource (exclude cancelled).
 */
export function aggregateRevenueByResource(
  bookings: AnalyticsBooking[]
): RevenueByResource[] {
  const map = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    map.set(b.resource_name, (map.get(b.resource_name) ?? 0) + b.total_price);
  }

  return Array.from(map.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Revenue by location
// ---------------------------------------------------------------------------

export type RevenueByLocation = {
  name: string;
  revenue: number;
};

/**
 * Sum revenue per location (exclude cancelled).
 * Null locations are grouped under noLocationLabel.
 */
export function aggregateRevenueByLocation(
  bookings: AnalyticsBooking[],
  noLocationLabel = "No location"
): RevenueByLocation[] {
  const map = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const locName = b.location_name ?? noLocationLabel;
    map.set(locName, (map.get(locName) ?? 0) + b.total_price);
  }

  return Array.from(map.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Bookings by status over time
// ---------------------------------------------------------------------------

export type BookingsByStatusPoint = {
  date: string;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
};

const EMPTY_STATUS_COUNTS = {
  pending: 0,
  confirmed: 0,
  completed: 0,
  cancelled: 0,
  no_show: 0,
} as const;

/**
 * Count bookings per time bucket grouped by status (all statuses included).
 */
export function aggregateBookingsByStatus(
  bookings: AnalyticsBooking[],
  interval: "day" | "week"
): BookingsByStatusPoint[] {
  const map = new Map<string, BookingsByStatusPoint>();

  for (const b of bookings) {
    const parsed = parseISO(b.start_time);
    const key =
      interval === "day"
        ? format(parsed, "yyyy-MM-dd")
        : format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd");

    if (!map.has(key)) {
      map.set(key, { date: key, ...EMPTY_STATUS_COUNTS });
    }

    const point = map.get(key)!;
    const status = b.status as keyof typeof EMPTY_STATUS_COUNTS;
    if (status in EMPTY_STATUS_COUNTS) {
      point[status] += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ---------------------------------------------------------------------------
// Top customers
// ---------------------------------------------------------------------------

export type TopCustomer = {
  name: string;
  email: string;
  bookings: number;
  totalSpent: number;
};

/**
 * Rank customers by total spend.
 * All bookings count toward volume; cancelled bookings are excluded from revenue.
 */
export function aggregateTopCustomers(
  bookings: AnalyticsBooking[],
  limit = 10
): TopCustomer[] {
  const map = new Map<
    string,
    { name: string; email: string; count: number; spent: number }
  >();

  for (const b of bookings) {
    const existing = map.get(b.booker_id);
    if (existing) {
      existing.count += 1;
      if (b.status !== "cancelled") {
        existing.spent += b.total_price;
      }
    } else {
      map.set(b.booker_id, {
        name: b.booker_name,
        email: b.booker_email,
        count: 1,
        spent: b.status !== "cancelled" ? b.total_price : 0,
      });
    }
  }

  return Array.from(map.values())
    .map((c) => ({
      name: c.name,
      email: c.email,
      bookings: c.count,
      totalSpent: c.spent,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export type SummaryStats = {
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
};

/**
 * Compute high-level summary stats.
 * Revenue excludes cancelled; totalBookings includes all statuses.
 */
export function computeSummaryStats(
  bookings: AnalyticsBooking[]
): SummaryStats {
  let totalRevenue = 0;
  let nonCancelledCount = 0;

  for (const b of bookings) {
    if (b.status !== "cancelled") {
      totalRevenue += b.total_price;
      nonCancelledCount += 1;
    }
  }

  return {
    totalRevenue,
    totalBookings: bookings.length,
    avgBookingValue: nonCancelledCount > 0 ? totalRevenue / nonCancelledCount : 0,
  };
}
