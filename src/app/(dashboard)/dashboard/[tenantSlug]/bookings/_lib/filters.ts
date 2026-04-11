import {
  BOOKING_TABS,
  type BookingsFilters,
  type BookingTab,
  type HasAddOnsFilter,
} from "./types";

/**
 * Next.js App Router `searchParams` is `Record<string, string | string[] | undefined>`.
 * We accept the loose shape and normalize to a typed `BookingsFilters`.
 * Invalid values silently fall back to defaults — never 500s.
 */
export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const TAB_SET = new Set<BookingTab>(BOOKING_TABS);

function parseTab(raw: string | undefined): BookingTab {
  if (raw && (TAB_SET as Set<string>).has(raw)) {
    return raw as BookingTab;
  }
  return "all";
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(raw: string | undefined): string | null {
  if (!raw || !ISO_DATE_RE.test(raw)) return null;
  // Sanity: ensure the date is actually valid (rejects 2026-02-30)
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return raw;
}

function parseHasAddOns(raw: string | undefined): HasAddOnsFilter {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
}

function parsePage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseSearchParams(
  params: RawSearchParams
): BookingsFilters {
  const q = first(params.q)?.trim() ?? "";
  return {
    tab: parseTab(first(params.tab)),
    q,
    locationId: first(params.location) ?? null,
    resourceId: first(params.resource) ?? null,
    fromDate: parseIsoDate(first(params.from)),
    toDate: parseIsoDate(first(params.to)),
    hasAddOns: parseHasAddOns(first(params.has_add_ons)),
    page: parsePage(first(params.page)),
  };
}

/**
 * Inverse of `parseSearchParams`. Omits defaults so URLs stay clean.
 * Used by client components that mutate filter state via `router.replace()`.
 */
export function filtersToSearchParams(
  filters: BookingsFilters
): URLSearchParams {
  const qs = new URLSearchParams();
  if (filters.tab !== "all") qs.set("tab", filters.tab);
  if (filters.q) qs.set("q", filters.q);
  if (filters.locationId) qs.set("location", filters.locationId);
  if (filters.resourceId) qs.set("resource", filters.resourceId);
  if (filters.fromDate) qs.set("from", filters.fromDate);
  if (filters.toDate) qs.set("to", filters.toDate);
  if (filters.hasAddOns === true) qs.set("has_add_ons", "1");
  if (filters.hasAddOns === false) qs.set("has_add_ons", "0");
  if (filters.page > 1) qs.set("page", String(filters.page));
  return qs;
}

/** True if any non-default filter is active. Used to decide whether to show
 * the "Limpiar filtros" text button in the filter bar. */
export function hasActiveFilters(filters: BookingsFilters): boolean {
  return (
    filters.tab !== "all" ||
    filters.q !== "" ||
    filters.locationId !== null ||
    filters.resourceId !== null ||
    filters.fromDate !== null ||
    filters.toDate !== null ||
    filters.hasAddOns !== null
  );
}

/** Converts a local ISO date + "start" | "end" to a Chile-timezone-anchored
 * UTC timestamp. `start` means 00:00:00 on that local day; `end` means
 * 23:59:59.999 on that local day. MVP assumption: all tenants are on
 * America/Santiago. Multi-timezone tenants will be handled in a future spec
 * (see open implementation note #5 in the design spec). */
export function localDateToUtc(
  isoDate: string,
  boundary: "start" | "end"
): string {
  // Chile is UTC-3 year-round (no DST since 2022 in most regions).
  // This is intentionally simplified for MVP.
  const CHILE_OFFSET_HOURS = 3;
  const [y, m, d] = isoDate.split("-").map(Number);
  const time =
    boundary === "start"
      ? { h: 0, mi: 0, s: 0, ms: 0 }
      : { h: 23, mi: 59, s: 59, ms: 999 };
  const utc = new Date(
    Date.UTC(y, m - 1, d, time.h + CHILE_OFFSET_HOURS, time.mi, time.s, time.ms)
  );
  return utc.toISOString();
}
