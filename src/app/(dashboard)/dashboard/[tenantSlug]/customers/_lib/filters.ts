import {
  CUSTOMERS_SORTS,
  type CustomersFilters,
  type CustomersSort,
} from "./types";

/**
 * Next.js App Router `searchParams` is `Record<string, string | string[] | undefined>`.
 * Accept the loose shape and normalize to a typed `CustomersFilters`.
 * Invalid values silently fall back to defaults — never 500s.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const SORT_SET = new Set<CustomersSort>(CUSTOMERS_SORTS);

function parseSort(raw: string | undefined): CustomersSort {
  if (raw && (SORT_SET as Set<string>).has(raw)) {
    return raw as CustomersSort;
  }
  return "spend";
}

function parsePage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseSearchParams(
  params: RawSearchParams
): CustomersFilters {
  return {
    q: first(params.q)?.trim() ?? "",
    sort: parseSort(first(params.sort)),
    page: parsePage(first(params.page)),
  };
}

/**
 * Inverse of `parseSearchParams`. Omits defaults so URLs stay clean.
 * Used by client components that mutate filter state via `router.replace()`.
 */
export function filtersToSearchParams(
  filters: CustomersFilters
): URLSearchParams {
  const qs = new URLSearchParams();
  if (filters.q) qs.set("q", filters.q);
  if (filters.sort !== "spend") qs.set("sort", filters.sort);
  if (filters.page > 1) qs.set("page", String(filters.page));
  return qs;
}

export function hasActiveFilters(filters: CustomersFilters): boolean {
  return filters.q !== "" || filters.sort !== "spend";
}
