import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  PAGE_SIZE,
  type BookingsFilters,
  type BookingTab,
  type CountsByTab,
} from "./types";
import { localDateToUtc } from "./filters";

/**
 * Row-select shape consumed by the list page. Must match `BookingRow`
 * in `types.ts`. Any change to the columns needs a matching change there.
 */
export const ROW_SELECT = `
  id,
  booking_number,
  start_time,
  duration_hours,
  total_price,
  paid_amount,
  payment_status,
  status,
  has_add_ons,
  resource:resources!inner(
    id,
    name,
    tenant_id
  ),
  location:locations(
    id,
    name,
    timezone
  ),
  booker:bookers!inner(
    id,
    name,
    email,
    phone
  )
`;

type Client = SupabaseClient<Database>;

function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Applies tab-specific narrowing to a query chain. Returns the chain so it
 * can be further filtered. `now` is injected to keep the function pure and
 * testable (no hidden `Date.now()`).
 */
function applyTabFilter<T>(
  chain: T,
  tab: BookingTab,
  now: Date
): T {
  // Cast so we can call the chained methods. Each method returns the
  // same chain reference in Supabase's query builder.
  const q = chain as unknown as {
    eq: (col: string, val: unknown) => T;
    in: (col: string, vals: unknown[]) => T;
    gte: (col: string, val: unknown) => T;
    lte: (col: string, val: unknown) => T;
    lt: (col: string, val: unknown) => T;
  };

  type Q = typeof q;
  switch (tab) {
    case "pending":
      return q.eq("status", "pending");
    case "unpaid":
      return (q.eq("status", "confirmed") as unknown as Q).in(
        "payment_status",
        ["unpaid", "partial"]
      );
    case "upcoming":
      return (
        (q.eq("status", "confirmed") as unknown as Q).gte(
          "start_time",
          now.toISOString()
        ) as unknown as Q
      ).lte("start_time", addDaysUtc(now, 7).toISOString());
    case "past_due":
      return (q.eq("status", "confirmed") as unknown as Q).lt(
        "start_time",
        now.toISOString()
      );
    case "archived":
      return q.in("status", ["completed", "cancelled", "no_show"]);
    case "all":
    default:
      return chain;
  }
}

function applyNonTabFilters<T>(
  chain: T,
  filters: BookingsFilters
): T {
  const q = chain as unknown as {
    eq: (col: string, val: unknown) => T;
    gte: (col: string, val: unknown) => T;
    lte: (col: string, val: unknown) => T;
  };
  let out: T = chain;
  if (filters.locationId) {
    out = (q as never as { eq: (c: string, v: unknown) => T }).eq(
      "location_id",
      filters.locationId
    );
  }
  if (filters.resourceId) {
    out = (out as never as { eq: (c: string, v: unknown) => T }).eq(
      "resource_id",
      filters.resourceId
    );
  }
  if (filters.fromDate) {
    out = (out as never as { gte: (c: string, v: unknown) => T }).gte(
      "start_time",
      localDateToUtc(filters.fromDate, "start")
    );
  }
  if (filters.toDate) {
    out = (out as never as { lte: (c: string, v: unknown) => T }).lte(
      "start_time",
      localDateToUtc(filters.toDate, "end")
    );
  }
  if (filters.hasAddOns !== null) {
    out = (out as never as { eq: (c: string, v: unknown) => T }).eq(
      "has_add_ons",
      filters.hasAddOns
    );
  }
  return out;
}

export type BookingsQueryResult = {
  data: unknown;
  count: number | null;
  error: unknown;
};

/**
 * Runs the main list query for the bookings page. Unlike `build*Query`
 * helpers elsewhere, this one is async because the text-search branch
 * needs two round-trips: first the RPC to find matching booking IDs,
 * then a standard select to rehydrate the joined `ROW_SELECT` shape
 * (the RPC returns `setof public.bookings` — no joined booker/resource/
 * location columns, which the UI needs).
 *
 * Branches:
 * 1. No text query → single `.from('bookings').select(ROW_SELECT)` with
 *    tenant guard + tab/filter chain.
 * 2. Text query → call `search_bookings` + `search_bookings_count` RPCs
 *    in parallel, then rehydrate rows with joined shape via `.in('id', ids)`.
 *    Preserves the RPC's efficient cross-table ILIKE.
 */
export async function buildBookingsQuery(
  supabase: Client,
  tenantId: string,
  filters: BookingsFilters,
  now: Date
): Promise<BookingsQueryResult> {
  if (filters.q) {
    const rpcArgs = {
      p_tenant_id: tenantId,
      p_query: filters.q,
      p_tab: filters.tab,
      p_location_id: filters.locationId ?? undefined,
      p_resource_id: filters.resourceId ?? undefined,
      p_from: filters.fromDate
        ? localDateToUtc(filters.fromDate, "start")
        : undefined,
      p_to: filters.toDate ? localDateToUtc(filters.toDate, "end") : undefined,
      p_has_add_ons: filters.hasAddOns ?? undefined,
    };

    const [idResult, countResult] = await Promise.all([
      supabase.rpc("search_bookings", { ...rpcArgs, p_page: filters.page }),
      supabase.rpc("search_bookings_count", rpcArgs),
    ]);

    if (idResult.error) {
      return { data: null, count: null, error: idResult.error };
    }

    const rpcRows = (idResult.data ?? []) as Array<{ id: string }>;
    const ids = rpcRows.map((r) => r.id);
    const count =
      (countResult.data as number | null) ?? (countResult.error ? null : 0);

    if (ids.length === 0) {
      return { data: [], count, error: null };
    }

    // Rehydrate with joined shape, preserving the RPC's ordering.
    const hydrated = await supabase
      .from("bookings")
      .select(ROW_SELECT)
      .in("id", ids)
      .order("start_time", { ascending: false });

    return {
      data: hydrated.data,
      count,
      error: hydrated.error,
    };
  }

  let q = supabase
    .from("bookings")
    .select(ROW_SELECT, { count: "exact" })
    .eq("resource.tenant_id", tenantId);

  q = applyTabFilter(q, filters.tab, now) as typeof q;
  q = applyNonTabFilters(q, filters) as typeof q;

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const result = await q.order("start_time", { ascending: false }).range(from, to);
  return { data: result.data, count: result.count, error: result.error };
}

/**
 * Builds one count query per tab, respecting all non-tab filters. Returns
 * a dict of promises the caller `Promise.all`s. Count queries that fail
 * individually should surface as `null` counts (caller responsibility).
 */
export function buildCountsQuery(
  supabase: Client,
  tenantId: string,
  filters: BookingsFilters,
  now: Date
): Record<BookingTab, unknown> {
  const tabs: BookingTab[] = [
    "all",
    "pending",
    "unpaid",
    "upcoming",
    "past_due",
    "archived",
  ];

  const out = {} as Record<BookingTab, unknown>;
  for (const tab of tabs) {
    if (filters.q) {
      out[tab] = supabase.rpc("search_bookings_count", {
        p_tenant_id: tenantId,
        p_query: filters.q,
        p_tab: tab,
        p_location_id: filters.locationId ?? undefined,
        p_resource_id: filters.resourceId ?? undefined,
        p_from: filters.fromDate
          ? localDateToUtc(filters.fromDate, "start")
          : undefined,
        p_to: filters.toDate
          ? localDateToUtc(filters.toDate, "end")
          : undefined,
        p_has_add_ons: filters.hasAddOns ?? undefined,
      });
    } else {
      let q = supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("resource.tenant_id", tenantId);
      q = applyTabFilter(q, tab, now) as typeof q;
      q = applyNonTabFilters(q, filters) as typeof q;
      out[tab] = q;
    }
  }
  return out;
}

/**
 * Convenience wrapper for the page component: awaits the counts dict and
 * maps individual rejections to `null`, so one slow/failed count doesn't
 * take down the whole page.
 */
export async function resolveCounts(
  queries: Record<BookingTab, unknown>
): Promise<CountsByTab> {
  const entries = await Promise.all(
    (Object.entries(queries) as [BookingTab, PromiseLike<{ count: number | null; error: unknown }>][]).map(
      async ([tab, q]) => {
        try {
          const { count, error } = await q;
          if (error) return [tab, null] as const;
          return [tab, count ?? 0] as const;
        } catch {
          return [tab, null] as const;
        }
      }
    )
  );
  return Object.fromEntries(entries) as CountsByTab;
}
