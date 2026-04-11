import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  CUSTOMERS_PAGE_SIZE,
  type CustomerRow,
  type CustomersFilters,
} from "./types";

type Client = SupabaseClient<Database>;

type BookingAggregateRow = {
  start_time: string;
  paid_amount: number | null;
  booker:
    | {
        id: string;
        name: string;
        email: string;
        phone: string | null;
      }
    | Array<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
      }>;
};

/**
 * RLS ("Tenant owner can read bookers for their bookings") restricts what
 * we can see, but we still filter explicitly on `resource.tenant_id` so the
 * query plan is deterministic regardless of the policy chain.
 *
 * Cancelled bookings are excluded at the query level so they contribute
 * nothing to counts, spend, or last-booking timestamps.
 */
const SELECT_SHAPE = `
  start_time,
  paid_amount,
  booker:bookers!inner(
    id,
    name,
    email,
    phone
  ),
  resource:resources!inner(
    tenant_id
  )
`;

function normalizeBooker(
  booker: BookingAggregateRow["booker"]
): { id: string; name: string; email: string; phone: string | null } | null {
  if (!booker) return null;
  if (Array.isArray(booker)) return booker[0] ?? null;
  return booker;
}

export type FetchCustomersResult = {
  rows: CustomerRow[];
  filteredCount: number;
  totalCount: number;
};

/**
 * Fetches all non-cancelled bookings for the tenant, groups them in memory by
 * booker, applies search/sort/pagination. MVP tenant sizes (demo: 200
 * bookings / 80 bookers) make this cheaper than a bespoke RPC. Swap for a
 * `list_customers_for_tenant` RPC if the numbers ever justify it.
 */
export async function fetchCustomers(
  supabase: Client,
  tenantId: string,
  filters: CustomersFilters
): Promise<FetchCustomersResult> {
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT_SHAPE)
    .eq("resource.tenant_id", tenantId)
    .neq("status", "cancelled");

  if (error) {
    // Surface an empty list rather than throwing — the page treats this
    // the same as "no customers" and remains usable.
    return { rows: [], filteredCount: 0, totalCount: 0 };
  }

  const aggregated = aggregateBookersFromBookings(
    (data ?? []) as BookingAggregateRow[]
  );
  const totalCount = aggregated.length;

  const searched = filters.q
    ? filterBySearch(aggregated, filters.q)
    : aggregated;
  const sorted = sortCustomers(searched, filters.sort);
  const filteredCount = sorted.length;

  const start = (filters.page - 1) * CUSTOMERS_PAGE_SIZE;
  const rows = sorted.slice(start, start + CUSTOMERS_PAGE_SIZE);

  return { rows, filteredCount, totalCount };
}

function aggregateBookersFromBookings(
  bookings: BookingAggregateRow[]
): CustomerRow[] {
  const map = new Map<string, CustomerRow>();

  for (const b of bookings) {
    const booker = normalizeBooker(b.booker);
    if (!booker) continue;

    const paid = b.paid_amount ?? 0;
    const existing = map.get(booker.id);

    if (!existing) {
      map.set(booker.id, {
        id: booker.id,
        name: booker.name,
        email: booker.email,
        phone: booker.phone,
        bookingsCount: 1,
        totalPaid: paid,
        firstBookingAt: b.start_time,
        lastBookingAt: b.start_time,
      });
      continue;
    }

    existing.bookingsCount += 1;
    existing.totalPaid += paid;
    if (b.start_time < existing.firstBookingAt) {
      existing.firstBookingAt = b.start_time;
    }
    if (b.start_time > existing.lastBookingAt) {
      existing.lastBookingAt = b.start_time;
    }
  }

  return Array.from(map.values());
}

function filterBySearch(rows: CustomerRow[], query: string): CustomerRow[] {
  const q = query.toLowerCase();
  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    if (row.email.toLowerCase().includes(q)) return true;
    if (row.phone && row.phone.toLowerCase().includes(q)) return true;
    return false;
  });
}

function sortCustomers(
  rows: CustomerRow[],
  sort: CustomersFilters["sort"]
): CustomerRow[] {
  const copy = [...rows];
  switch (sort) {
    case "spend":
      // Tie-break by most-recent booking so equal-spend customers are
      // ordered predictably.
      copy.sort((a, b) => {
        if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
        return b.lastBookingAt.localeCompare(a.lastBookingAt);
      });
      return copy;
    case "recent":
      copy.sort((a, b) => b.lastBookingAt.localeCompare(a.lastBookingAt));
      return copy;
    case "name":
      copy.sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
      return copy;
  }
}
