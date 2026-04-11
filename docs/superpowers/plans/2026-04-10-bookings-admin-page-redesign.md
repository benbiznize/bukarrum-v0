# Bookings Admin Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bookings admin page redesign described in [2026-04-10-bookings-admin-page-redesign-design.md](../specs/2026-04-10-bookings-admin-page-redesign-design.md): Shopify-style list with tabs / omnibox / filters / bulk actions, plus five targeted fixes to the detail page, backed by a single database migration.

**Architecture:** URL-as-source-of-truth with Server Components rendering the core. Small client islands (`omnibox`, `tab strip`, `filter bar`, `pagination`, `bulk action bar`) handle ephemeral state. React 19 `useOptimistic` only wraps bulk actions. Pure logic (`parseSearchParams`, `buildBookingsQuery`, `buildCountsQuery`) is colocated under `bookings/_lib/` and unit-tested with vitest. Everything else is presentation or DB round-trips tested via Playwright E2E.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (PostgreSQL + RLS), shadcn/ui, Base UI, Tailwind CSS, sonner (toasts), vitest (new, unit tests), Playwright (E2E), date-fns.

**Prerequisites:**
- Work on a dedicated branch `feature/bookings-admin-redesign` created from up-to-date `origin/main`.
- Local Supabase running (`npx supabase start`).
- Baseline green: `npm run type-check && npm run lint && npm run db:reset` all pass before Task 1.

**Branch setup (run once before Task 1):**

```bash
git checkout main
git fetch origin
git reset --hard origin/main
git checkout -b feature/bookings-admin-redesign
```

---

## Task index

1. Add vitest and a `test:unit` script
2. Database migration — indexes, `has_add_ons` column + trigger, `search_bookings` RPC
3. Regenerate Supabase types and reset the DB
4. `_lib/types.ts` — shared types for filters, tabs, rows, counts
5. `_lib/filters.ts` — `parseSearchParams` (TDD)
6. `_lib/queries.ts` — `buildBookingsQuery` + `buildCountsQuery` (TDD with mock Supabase)
7. `_lib/csv.ts` — `bookingsToCsv` (TDD)
8. i18n dictionary additions (es + en)
9. Install sonner + shadcn Checkbox, wire Toaster into dashboard layout
10. Bulk Server Actions — `confirmBookings`, `cancelBookings`, `markBookingsNoShow`
11. CSV export route handler
12. Scaffold `page.tsx` + `_components/bookings-header.tsx` + `bookings-empty-state.tsx`
13. `bookings-omnibox.tsx` (client)
14. `bookings-tabs.tsx` (client)
15. `bookings-filter-bar.tsx` (client)
16. `bookings-table.tsx` + `bookings-row.tsx` (server)
17. `bookings-pagination.tsx` (client)
18. Selection context + `bookings-bulk-action-bar.tsx` (client, `useOptimistic`)
19. Wire the new components into `page.tsx` and delete the legacy layout
20. `booking-quick-actions.tsx` (detail page quick-action rail)
21. Detail page refactor — 5 targeted fixes
22. Playwright E2E — `tests/app/dashboard/bookings-page.spec.ts`
23. Manual QA walkthrough + typecheck/lint/migration verification
24. Push branch (stop)

---

## Task 1: Add vitest and a `test:unit` script

**Why this first:** the `_lib/` logic is the highest-risk surface (URL parsing + tenant-isolated query building) and the project has no unit test framework. vitest is one dependency, TypeScript-native, and the standard for Next.js projects.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest @vitest/ui
```

Expected: `package.json` gains `"vitest"` and `"@vitest/ui"` in `devDependencies`. No runtime deps added.

- [ ] **Step 2: Add `vitest.config.ts`**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add `test:unit` script to `package.json`**

Edit the `"scripts"` block to add:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test to confirm vitest runs**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/__tests__/vitest-smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

```bash
npm run test:unit
```

Expected output includes:
```
✓ src/__tests__/vitest-smoke.test.ts (1)
  ✓ vitest smoke
    ✓ runs
Test Files  1 passed (1)
```

- [ ] **Step 6: Type-check passes**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/__tests__/vitest-smoke.test.ts
git commit -m "Add vitest for unit tests on _lib/ modules"
```

---

## Task 2: Database migration — indexes, `has_add_ons`, `search_bookings` RPC

**Files:**
- Create: `supabase/migrations/20260414120000_bookings_page_redesign.sql`

- [ ] **Step 1: Create the migration file**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/supabase/migrations/20260414120000_bookings_page_redesign.sql`:

```sql
-- Bookings admin page redesign: indexes, has_add_ons materialized column, search_bookings RPC.
-- See docs/superpowers/specs/2026-04-10-bookings-admin-page-redesign-design.md

-- ----------------------------------------------------------------
-- 1. Indexes for list-page filter/sort queries
-- ----------------------------------------------------------------

-- Main list query: scoped via resource FK, sorted by start_time desc
create index if not exists bookings_resource_start_idx
  on public.bookings (resource_id, start_time desc);

-- Location-scoped filter with same sort
create index if not exists bookings_location_start_idx
  on public.bookings (location_id, start_time desc);

-- Partial index for hot tabs (pending + confirmed). The 'archived' tabs
-- (completed, cancelled, no_show) are cold — a full index would waste
-- space on rows that are rarely filtered.
create index if not exists bookings_status_pending_confirmed_idx
  on public.bookings (status)
  where status in ('pending', 'confirmed');

-- Composite for the 'unpaid' queue (status='confirmed' + payment_status in partial/unpaid)
create index if not exists bookings_status_payment_idx
  on public.bookings (status, payment_status);

-- ----------------------------------------------------------------
-- 2. has_add_ons materialized column + trigger
-- ----------------------------------------------------------------

alter table public.bookings
  add column if not exists has_add_ons boolean not null default false;

-- Backfill existing rows
update public.bookings b
set has_add_ons = exists (
  select 1 from public.booking_add_ons ba where ba.booking_id = b.id
);

-- Keep the column in sync via a trigger on booking_add_ons
create or replace function public.update_booking_has_add_ons()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.bookings
      set has_add_ons = true
      where id = new.booking_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.bookings
      set has_add_ons = exists (
        select 1 from public.booking_add_ons
          where booking_id = old.booking_id
      )
      where id = old.booking_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists booking_add_ons_sync_has_add_ons on public.booking_add_ons;
create trigger booking_add_ons_sync_has_add_ons
  after insert or delete on public.booking_add_ons
  for each row
  execute function public.update_booking_has_add_ons();

create index if not exists bookings_has_add_ons_idx
  on public.bookings (has_add_ons)
  where has_add_ons = true;

-- ----------------------------------------------------------------
-- 3. search_bookings RPC
-- ----------------------------------------------------------------

-- Returns booking rows matching a tenant-scoped search + filter combo.
-- Security: SECURITY INVOKER, so Supabase RLS + tenant_id check in the
-- WHERE clause enforce isolation.
create or replace function public.search_bookings(
  p_tenant_id uuid,
  p_query text default '',
  p_tab text default 'all',
  p_location_id uuid default null,
  p_resource_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_has_add_ons boolean default null,
  p_page int default 1
)
returns setof public.bookings
language sql
stable
security invoker
as $$
  select b.*
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.bookers bk on bk.id = b.booker_id
  where r.tenant_id = p_tenant_id
    and (
      coalesce(p_query, '') = ''
      or b.booking_number::text ilike '%' || p_query || '%'
      or bk.name ilike '%' || p_query || '%'
      or bk.email ilike '%' || p_query || '%'
      or coalesce(bk.phone, '') ilike '%' || p_query || '%'
    )
    and (
      p_tab = 'all'
      or (p_tab = 'pending' and b.status = 'pending')
      or (p_tab = 'unpaid'
          and b.status = 'confirmed'
          and b.payment_status in ('unpaid', 'partial'))
      or (p_tab = 'upcoming'
          and b.status = 'confirmed'
          and b.start_time >= now()
          and b.start_time <= now() + interval '7 days')
      or (p_tab = 'past_due'
          and b.status = 'confirmed'
          and b.start_time < now())
      or (p_tab = 'archived'
          and b.status in ('completed', 'cancelled', 'no_show'))
    )
    and (p_location_id is null or b.location_id = p_location_id)
    and (p_resource_id is null or b.resource_id = p_resource_id)
    and (p_from is null or b.start_time >= p_from)
    and (p_to is null or b.start_time <= p_to)
    and (p_has_add_ons is null or b.has_add_ons = p_has_add_ons)
  order by b.start_time desc
  limit 50
  offset greatest(p_page - 1, 0) * 50;
$$;

-- Count variant of the same search (for the header "12 of N" subtitle and
-- for the single tab's total when a query is active).
create or replace function public.search_bookings_count(
  p_tenant_id uuid,
  p_query text default '',
  p_tab text default 'all',
  p_location_id uuid default null,
  p_resource_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_has_add_ons boolean default null
)
returns bigint
language sql
stable
security invoker
as $$
  select count(*)::bigint
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.bookers bk on bk.id = b.booker_id
  where r.tenant_id = p_tenant_id
    and (
      coalesce(p_query, '') = ''
      or b.booking_number::text ilike '%' || p_query || '%'
      or bk.name ilike '%' || p_query || '%'
      or bk.email ilike '%' || p_query || '%'
      or coalesce(bk.phone, '') ilike '%' || p_query || '%'
    )
    and (
      p_tab = 'all'
      or (p_tab = 'pending' and b.status = 'pending')
      or (p_tab = 'unpaid'
          and b.status = 'confirmed'
          and b.payment_status in ('unpaid', 'partial'))
      or (p_tab = 'upcoming'
          and b.status = 'confirmed'
          and b.start_time >= now()
          and b.start_time <= now() + interval '7 days')
      or (p_tab = 'past_due'
          and b.status = 'confirmed'
          and b.start_time < now())
      or (p_tab = 'archived'
          and b.status in ('completed', 'cancelled', 'no_show'))
    )
    and (p_location_id is null or b.location_id = p_location_id)
    and (p_resource_id is null or b.resource_id = p_resource_id)
    and (p_from is null or b.start_time >= p_from)
    and (p_to is null or b.start_time <= p_to)
    and (p_has_add_ons is null or b.has_add_ons = p_has_add_ons);
$$;
```

- [ ] **Step 2: Apply the migration via `db:reset`**

```bash
npm run db:reset
```

Expected: migration applies cleanly, seed runs to completion, no errors.

- [ ] **Step 3: Verify via psql smoke queries**

```bash
npx supabase db psql --local -c "\d public.bookings" | grep has_add_ons
```

Expected output includes `has_add_ons | boolean | not null default false`.

```bash
npx supabase db psql --local -c "select count(*) from public.bookings where has_add_ons = true;"
```

Expected: some positive count (the seed generates bookings with add-ons).

```bash
npx supabase db psql --local -c "\df public.search_bookings public.search_bookings_count"
```

Expected: both functions listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120000_bookings_page_redesign.sql
git commit -m "Add indexes, has_add_ons column, and search_bookings RPC"
```

---

## Task 3: Regenerate Supabase types

**Files:**
- Modify: `src/lib/supabase/database.types.ts` (generated)

- [ ] **Step 1: Regenerate**

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

- [ ] **Step 2: Verify new surface area**

```bash
grep -n "has_add_ons\|search_bookings" src/lib/supabase/database.types.ts | head -20
```

Expected: `has_add_ons` appears in the `bookings` Row/Insert/Update types, and `search_bookings` + `search_bookings_count` appear under `Functions`.

- [ ] **Step 3: Type-check passes with new types**

```bash
npm run type-check
```

Expected: no errors. The existing code doesn't reference `has_add_ons` so no breakage.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "Regenerate Supabase types after bookings migration"
```

---

## Task 4: `_lib/types.ts` — shared types

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/types.ts`

- [ ] **Step 1: Create the types module**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/types.ts`:

```ts
import type { Database } from "@/lib/supabase/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PaymentStatus =
  Database["public"]["Enums"]["booking_payment_status"];

export const BOOKING_TABS = [
  "all",
  "pending",
  "unpaid",
  "upcoming",
  "past_due",
  "archived",
] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export const PAGE_SIZE = 50;

export type HasAddOnsFilter = true | false | null;

export type BookingsFilters = {
  tab: BookingTab;
  q: string;
  locationId: string | null;
  resourceId: string | null;
  /** ISO date (YYYY-MM-DD) in tenant local time, inclusive start. */
  fromDate: string | null;
  /** ISO date (YYYY-MM-DD) in tenant local time, inclusive end. */
  toDate: string | null;
  hasAddOns: HasAddOnsFilter;
  page: number;
};

export type CountsByTab = Record<BookingTab, number | null>;

/**
 * Row shape rendered in the list. Keep this in sync with ROW_SELECT in
 * `queries.ts` — any change there should reflect here.
 */
export type BookingRow = {
  id: string;
  booking_number: number;
  start_time: string;
  duration_hours: number;
  total_price: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  has_add_ons: boolean;
  resource: { id: string; name: string; tenant_id: string };
  location: { id: string; name: string; timezone: string } | null;
  booker: { id: string; name: string; email: string; phone: string | null };
};

export type ActionResult =
  | { success: true; affectedCount: number }
  | { success: false; error: string };
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors (unused module is allowed; it'll be consumed in the next tasks).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/types.ts"
git commit -m "Add shared types for bookings list filters and rows"
```

---

## Task 5: `_lib/filters.ts` — `parseSearchParams` (TDD)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/filters.ts`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSearchParams, filtersToSearchParams } from "../filters";

describe("parseSearchParams", () => {
  it("returns defaults when empty", () => {
    const f = parseSearchParams({});
    expect(f.tab).toBe("all");
    expect(f.q).toBe("");
    expect(f.locationId).toBeNull();
    expect(f.resourceId).toBeNull();
    expect(f.fromDate).toBeNull();
    expect(f.toDate).toBeNull();
    expect(f.hasAddOns).toBeNull();
    expect(f.page).toBe(1);
  });

  it("parses every valid tab", () => {
    for (const tab of [
      "all",
      "pending",
      "unpaid",
      "upcoming",
      "past_due",
      "archived",
    ] as const) {
      expect(parseSearchParams({ tab }).tab).toBe(tab);
    }
  });

  it("falls back to 'all' for unknown tab", () => {
    expect(parseSearchParams({ tab: "bogus" }).tab).toBe("all");
  });

  it("trims and keeps the omnibox query", () => {
    expect(parseSearchParams({ q: "  juan  " }).q).toBe("juan");
  });

  it("drops empty q to empty string", () => {
    expect(parseSearchParams({ q: "   " }).q).toBe("");
  });

  it("parses ISO dates and drops malformed ones", () => {
    expect(parseSearchParams({ from: "2026-04-01" }).fromDate).toBe(
      "2026-04-01"
    );
    expect(parseSearchParams({ from: "not-a-date" }).fromDate).toBeNull();
    expect(parseSearchParams({ to: "2026-12-31" }).toDate).toBe("2026-12-31");
  });

  it("parses has_add_ons tri-state", () => {
    expect(parseSearchParams({ has_add_ons: "1" }).hasAddOns).toBe(true);
    expect(parseSearchParams({ has_add_ons: "0" }).hasAddOns).toBe(false);
    expect(parseSearchParams({}).hasAddOns).toBeNull();
    expect(parseSearchParams({ has_add_ons: "bogus" }).hasAddOns).toBeNull();
  });

  it("parses a positive page and clamps invalid values to 1", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSearchParams({ page: "-5" }).page).toBe(1);
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
  });

  it("accepts array values (Next's searchParams shape) and picks the first", () => {
    expect(parseSearchParams({ tab: ["pending", "unpaid"] }).tab).toBe(
      "pending"
    );
  });
});

describe("filtersToSearchParams", () => {
  it("omits default/empty values", () => {
    const qs = filtersToSearchParams({
      tab: "all",
      q: "",
      locationId: null,
      resourceId: null,
      fromDate: null,
      toDate: null,
      hasAddOns: null,
      page: 1,
    });
    expect(qs.toString()).toBe("");
  });

  it("serializes non-default values", () => {
    const qs = filtersToSearchParams({
      tab: "pending",
      q: "juan",
      locationId: "loc-1",
      resourceId: "res-2",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      hasAddOns: true,
      page: 2,
    });
    expect(qs.get("tab")).toBe("pending");
    expect(qs.get("q")).toBe("juan");
    expect(qs.get("location")).toBe("loc-1");
    expect(qs.get("resource")).toBe("res-2");
    expect(qs.get("from")).toBe("2026-04-01");
    expect(qs.get("to")).toBe("2026-04-30");
    expect(qs.get("has_add_ons")).toBe("1");
    expect(qs.get("page")).toBe("2");
  });

  it("serializes has_add_ons=false as 0", () => {
    const qs = filtersToSearchParams({
      tab: "all",
      q: "",
      locationId: null,
      resourceId: null,
      fromDate: null,
      toDate: null,
      hasAddOns: false,
      page: 1,
    });
    expect(qs.get("has_add_ons")).toBe("0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- filters.test.ts
```

Expected: fails with `Failed to resolve import "../filters"`.

- [ ] **Step 3: Write the minimal implementation**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/filters.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- filters.test.ts
```

Expected:
```
✓ src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/filters.test.ts
Test Files  1 passed
Tests  11 passed
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/filters.ts" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/filters.test.ts"
git commit -m "Add parseSearchParams and filtersToSearchParams for bookings list"
```

---

## Task 6: `_lib/queries.ts` — `buildBookingsQuery` + `buildCountsQuery` (TDD)

**What we're building:** A pure composer that takes a Supabase client, tenant id, and `BookingsFilters` and produces a prepared query. Pure logic — we mock the Supabase chain and assert the calls.

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/queries.ts`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildBookingsQuery, buildCountsQuery, ROW_SELECT } from "../queries";
import type { BookingsFilters } from "../types";

type Spy = ReturnType<typeof vi.fn>;

type MockChain = {
  select: Spy;
  eq: Spy;
  in: Spy;
  gte: Spy;
  lte: Spy;
  lt: Spy;
  or: Spy;
  order: Spy;
  range: Spy;
};

function makeChain(): MockChain {
  const chain = {} as MockChain;
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.range = vi.fn(self);
  return chain;
}

function makeClient() {
  const chain = makeChain();
  const from = vi.fn(() => chain);
  const rpc = vi.fn(() => chain);
  return { from, rpc, chain };
}

const TENANT_ID = "tenant-123";

function baseFilters(overrides: Partial<BookingsFilters> = {}): BookingsFilters {
  return {
    tab: "all",
    q: "",
    locationId: null,
    resourceId: null,
    fromDate: null,
    toDate: null,
    hasAddOns: null,
    page: 1,
    ...overrides,
  };
}

describe("buildBookingsQuery", () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  it("selects from bookings with the ROW_SELECT shape", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.from).toHaveBeenCalledWith("bookings");
    expect(client.chain.select).toHaveBeenCalledWith(
      ROW_SELECT,
      expect.objectContaining({ count: "exact" })
    );
  });

  it("always applies the tenant-isolation filter on the joined resource", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("resource.tenant_id", TENANT_ID);
  });

  it("'pending' tab narrows status", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "pending" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("'unpaid' tab narrows to confirmed + unpaid/partial", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "unpaid" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.in).toHaveBeenCalledWith("payment_status", [
      "unpaid",
      "partial",
    ]);
  });

  it("'upcoming' tab applies start_time bounds of [now, now+7d]", () => {
    const now = new Date("2026-04-10T12:00:00Z");
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "upcoming" }),
      now
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.gte).toHaveBeenCalledWith(
      "start_time",
      now.toISOString()
    );
    const expectedEnd = new Date(now);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 7);
    expect(client.chain.lte).toHaveBeenCalledWith(
      "start_time",
      expectedEnd.toISOString()
    );
  });

  it("'past_due' tab applies start_time < now on confirmed", () => {
    const now = new Date("2026-04-10T12:00:00Z");
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "past_due" }),
      now
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.lt).toHaveBeenCalledWith(
      "start_time",
      now.toISOString()
    );
  });

  it("'archived' tab narrows to completed/cancelled/no_show", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "archived" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.in).toHaveBeenCalledWith("status", [
      "completed",
      "cancelled",
      "no_show",
    ]);
  });

  it("applies location/resource/has_add_ons filters when present", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({
        locationId: "loc-1",
        resourceId: "res-1",
        hasAddOns: true,
      }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("location_id", "loc-1");
    expect(client.chain.eq).toHaveBeenCalledWith("resource_id", "res-1");
    expect(client.chain.eq).toHaveBeenCalledWith("has_add_ons", true);
  });

  it("applies has_add_ons=false when hasAddOns is false", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ hasAddOns: false }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("has_add_ons", false);
  });

  it("orders by start_time desc and paginates with range(0, 49) on page 1", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.order).toHaveBeenCalledWith("start_time", {
      ascending: false,
    });
    expect(client.chain.range).toHaveBeenCalledWith(0, 49);
  });

  it("paginates with range(100, 149) on page 3", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ page: 3 }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.range).toHaveBeenCalledWith(100, 149);
  });

  it("delegates to search_bookings RPC when q is present", () => {
    buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ q: "juan", tab: "pending" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "search_bookings",
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_query: "juan",
        p_tab: "pending",
      })
    );
    // RPC path: do NOT use the table query builder
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("buildCountsQuery", () => {
  it("returns 6 promises, one per tab", () => {
    const client = makeClient();
    const promises = buildCountsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(Object.keys(promises).sort()).toEqual(
      ["all", "archived", "past_due", "pending", "unpaid", "upcoming"].sort()
    );
  });

  it("each count query applies non-tab filters (location, resource, dates, has_add_ons, q)", () => {
    const client = makeClient();
    buildCountsQuery(
      client as never,
      TENANT_ID,
      baseFilters({
        locationId: "loc-1",
        resourceId: "res-1",
        fromDate: "2026-04-01",
        toDate: "2026-04-30",
        hasAddOns: true,
        q: "juan",
      }),
      new Date("2026-04-10T12:00:00Z")
    );
    // Every count query should use the search RPC when q is present
    expect(client.rpc).toHaveBeenCalledWith(
      "search_bookings_count",
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_query: "juan",
        p_location_id: "loc-1",
        p_resource_id: "res-1",
        p_has_add_ons: true,
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- queries.test.ts
```

Expected: fails with import resolution error.

- [ ] **Step 3: Write the implementation**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/queries.ts`:

```ts
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

  switch (tab) {
    case "pending":
      return q.eq("status", "pending");
    case "unpaid":
      return q
        .eq("status", "confirmed")
        .in("payment_status", ["unpaid", "partial"]);
    case "upcoming":
      return q
        .eq("status", "confirmed")
        .gte("start_time", now.toISOString())
        .lte("start_time", addDaysUtc(now, 7).toISOString());
    case "past_due":
      return q.eq("status", "confirmed").lt("start_time", now.toISOString());
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

/**
 * Builds the main list query for the bookings page.
 *
 * Two branches:
 * 1. No text query → chain `.from('bookings').select(...)` with tenant guard.
 * 2. Text query present → call `search_bookings` RPC which handles the
 *    multi-column ilike and all filters in a single round-trip.
 *
 * The caller should `await` the returned thenable to get `{ data, count }`.
 */
export function buildBookingsQuery(
  supabase: Client,
  tenantId: string,
  filters: BookingsFilters,
  now: Date
) {
  if (filters.q) {
    // RPC path
    return supabase.rpc("search_bookings", {
      p_tenant_id: tenantId,
      p_query: filters.q,
      p_tab: filters.tab,
      p_location_id: filters.locationId,
      p_resource_id: filters.resourceId,
      p_from: filters.fromDate
        ? localDateToUtc(filters.fromDate, "start")
        : null,
      p_to: filters.toDate ? localDateToUtc(filters.toDate, "end") : null,
      p_has_add_ons: filters.hasAddOns,
      p_page: filters.page,
    });
  }

  let q = supabase
    .from("bookings")
    .select(ROW_SELECT, { count: "exact" })
    .eq("resource.tenant_id", tenantId);

  q = applyTabFilter(q, filters.tab, now) as typeof q;
  q = applyNonTabFilters(q, filters) as typeof q;

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  return q.order("start_time", { ascending: false }).range(from, to);
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
        p_location_id: filters.locationId,
        p_resource_id: filters.resourceId,
        p_from: filters.fromDate
          ? localDateToUtc(filters.fromDate, "start")
          : null,
        p_to: filters.toDate ? localDateToUtc(filters.toDate, "end") : null,
        p_has_add_ons: filters.hasAddOns,
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
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- queries.test.ts
```

Expected: all 13 tests pass.

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/queries.ts" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/queries.test.ts"
git commit -m "Add buildBookingsQuery and buildCountsQuery for bookings list"
```

---

## Task 7: `_lib/csv.ts` — `bookingsToCsv` (TDD)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/csv.ts`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/csv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bookingsToCsv, type CsvBookingRow } from "../csv";

const row: CsvBookingRow = {
  booking_number: 1042,
  start_time: "2026-04-12T17:00:00Z",
  duration_hours: 3,
  total_price: 45000,
  paid_amount: 20000,
  payment_status: "partial",
  status: "confirmed",
  resource_name: "Estudio A",
  location_name: "Santiago Centro",
  location_timezone: "America/Santiago",
  booker_name: "Juan Pérez",
  booker_email: "juan@mail.cl",
  booker_phone: "+56912345678",
};

describe("bookingsToCsv", () => {
  it("starts with a UTF-8 BOM for Excel compatibility", () => {
    const csv = bookingsToCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("renders Spanish headers", () => {
    const csv = bookingsToCsv([row]);
    const header = csv.split("\n")[0].replace("\ufeff", "");
    expect(header).toBe(
      [
        "Número",
        "Fecha",
        "Hora",
        "Duración (h)",
        "Recurso",
        "Ubicación",
        "Cliente",
        "Email",
        "Teléfono",
        "Total (CLP)",
        "Pagado (CLP)",
        "Estado",
        "Pago",
      ].join(",")
    );
  });

  it("formats dates in the booking's own location timezone", () => {
    const csv = bookingsToCsv([row]);
    const cols = csv.split("\n")[1].split(",");
    // 2026-04-12T17:00:00Z in America/Santiago (UTC-3) is 14:00 on 2026-04-12
    expect(cols[1]).toBe("2026-04-12");
    expect(cols[2]).toBe("14:00");
  });

  it("quotes fields containing commas or quotes", () => {
    const messy: CsvBookingRow = {
      ...row,
      booker_name: 'Juan, "The" Boss',
    };
    const csv = bookingsToCsv([messy]);
    expect(csv).toContain('"Juan, ""The"" Boss"');
  });

  it("renders an empty phone as empty (not 'null')", () => {
    const noPhone: CsvBookingRow = { ...row, booker_phone: null };
    const csv = bookingsToCsv([noPhone]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[8]).toBe("");
  });

  it("renders multiple rows with LF line endings", () => {
    const csv = bookingsToCsv([row, row]);
    expect(csv.split("\n")).toHaveLength(4); // BOM header, row1, row2, trailing newline
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- csv.test.ts
```

Expected: import resolution failure.

- [ ] **Step 3: Write the implementation**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/csv.ts`:

```ts
import type { BookingStatus, PaymentStatus } from "./types";

export type CsvBookingRow = {
  booking_number: number;
  start_time: string;
  duration_hours: number;
  total_price: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  resource_name: string;
  location_name: string | null;
  location_timezone: string;
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
};

const BOM = "\ufeff";

const HEADERS = [
  "Número",
  "Fecha",
  "Hora",
  "Duración (h)",
  "Recurso",
  "Ubicación",
  "Cliente",
  "Email",
  "Teléfono",
  "Total (CLP)",
  "Pagado (CLP)",
  "Estado",
  "Pago",
] as const;

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDatePart(iso: string, tz: string): { date: string; time: string } {
  const dt = new Date(iso);
  // en-CA gives YYYY-MM-DD format reliably across environments.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(dt);
  return { date, time };
}

export function bookingsToCsv(rows: CsvBookingRow[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.join(","));
  for (const row of rows) {
    const { date, time } = formatDatePart(row.start_time, row.location_timezone);
    lines.push(
      [
        escape(row.booking_number),
        escape(date),
        escape(time),
        escape(row.duration_hours),
        escape(row.resource_name),
        escape(row.location_name ?? ""),
        escape(row.booker_name),
        escape(row.booker_email),
        escape(row.booker_phone ?? ""),
        escape(row.total_price),
        escape(row.paid_amount),
        escape(row.status),
        escape(row.payment_status),
      ].join(",")
    );
  }
  return BOM + lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- csv.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/csv.ts" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/csv.test.ts"
git commit -m "Add bookingsToCsv serializer with Spanish headers and BOM"
```

---

## Task 8: i18n dictionary additions (es + en)

**Files:**
- Modify: `src/lib/i18n/es.json`
- Modify: `src/lib/i18n/en.json`

- [ ] **Step 1: Add the new keys to `es.json`**

Open `/Users/benjaminjacksoncevasco/bukarrum-v0/src/lib/i18n/es.json` and find the `"dashboard": { ... }` block that already contains `"statusLabels"`, `"paymentLabels"`, `"bookingActions"`, and `"bookingDetail"`. Add the following new key `"bookingsList"` at the same nesting level (inside `dashboard`, next to `bookingDetail`):

```json
"bookingsList": {
  "countSummary": "{current} de {total} reservas",
  "searchPlaceholder": "Buscar por número, cliente, email o teléfono…",
  "noResultsSearch": "No hay reservas que coincidan con \"{query}\"",
  "noResultsFilter": "No hay reservas con estos filtros",
  "clearFilters": "Limpiar filtros",
  "tabs": {
    "all": "Todas",
    "pending": "Pendientes",
    "unpaid": "Por cobrar",
    "upcoming": "Próximas 7 días",
    "past_due": "Vencidas",
    "archived": "Archivadas"
  },
  "filters": {
    "date": "Fecha",
    "dateAll": "Cualquier fecha",
    "dateToday": "Hoy",
    "dateYesterday": "Ayer",
    "dateThisWeek": "Esta semana",
    "dateThisMonth": "Este mes",
    "dateLast30": "Últimos 30 días",
    "dateCustom": "Personalizado",
    "location": "Sede",
    "locationAll": "Todas las sedes",
    "resource": "Recurso",
    "resourceAll": "Todos los recursos",
    "addOnsAll": "Con o sin extras",
    "addOnsWith": "Con extras",
    "addOnsWithout": "Sin extras"
  },
  "columns": {
    "number": "Número",
    "when": "Cuándo",
    "customer": "Cliente",
    "duration": "Duración",
    "total": "Total",
    "status": "Estado"
  },
  "pagination": {
    "pageOf": "Página {current} de {total}",
    "previous": "Anterior",
    "next": "Siguiente"
  },
  "bulk": {
    "selected": "{count} seleccionadas",
    "confirm": "Confirmar",
    "cancel": "Cancelar",
    "noShow": "No-show",
    "export": "Exportar CSV",
    "deselect": "Deseleccionar",
    "cannotConfirmTooltip": "Solo reservas pendientes pueden confirmarse",
    "cannotNoShowTooltip": "Solo reservas confirmadas pasadas pueden marcarse como no-show",
    "confirmSuccess": "{count} reservas confirmadas",
    "cancelSuccess": "{count} reservas canceladas",
    "noShowSuccess": "{count} reservas marcadas como no-show",
    "exportSuccess": "CSV exportado",
    "actionError": "No se pudo completar la acción. Intenta de nuevo."
  },
  "detail": {
    "quickActions": {
      "confirm": "Confirmar",
      "addPayment": "+ Pago",
      "cancel": "Cancelar",
      "markCompleted": "Marcar como completada",
      "markNoShow": "Marcar no-show",
      "reactivate": "Reactivar",
      "copyLink": "Copiar enlace",
      "print": "Imprimir",
      "more": "Más acciones"
    },
    "sectionCustomer": "Cliente",
    "sectionLocation": "Ubicación",
    "sectionNotes": "Notas",
    "activityTitle": "Actividad",
    "activityCreated": "Reserva creada",
    "activityPayment": "Pago de {amount} registrado",
    "activityRefund": "Reembolso de {amount}",
    "linesAndPayments": "Líneas y pagos",
    "subtotal": "Subtotal",
    "paid": "Pagado",
    "remaining": "Restante"
  }
}
```

- [ ] **Step 2: Mirror the same keys in `en.json`**

Open `/Users/benjaminjacksoncevasco/bukarrum-v0/src/lib/i18n/en.json` and add the same `"bookingsList"` block with English translations:

```json
"bookingsList": {
  "countSummary": "{current} of {total} bookings",
  "searchPlaceholder": "Search by number, customer, email or phone…",
  "noResultsSearch": "No bookings match \"{query}\"",
  "noResultsFilter": "No bookings match these filters",
  "clearFilters": "Clear filters",
  "tabs": {
    "all": "All",
    "pending": "Pending",
    "unpaid": "Needs payment",
    "upcoming": "Next 7 days",
    "past_due": "Past due",
    "archived": "Archived"
  },
  "filters": {
    "date": "Date",
    "dateAll": "Any date",
    "dateToday": "Today",
    "dateYesterday": "Yesterday",
    "dateThisWeek": "This week",
    "dateThisMonth": "This month",
    "dateLast30": "Last 30 days",
    "dateCustom": "Custom",
    "location": "Location",
    "locationAll": "All locations",
    "resource": "Resource",
    "resourceAll": "All resources",
    "addOnsAll": "With or without add-ons",
    "addOnsWith": "With add-ons",
    "addOnsWithout": "Without add-ons"
  },
  "columns": {
    "number": "Number",
    "when": "When",
    "customer": "Customer",
    "duration": "Duration",
    "total": "Total",
    "status": "Status"
  },
  "pagination": {
    "pageOf": "Page {current} of {total}",
    "previous": "Previous",
    "next": "Next"
  },
  "bulk": {
    "selected": "{count} selected",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "noShow": "No-show",
    "export": "Export CSV",
    "deselect": "Deselect",
    "cannotConfirmTooltip": "Only pending bookings can be confirmed",
    "cannotNoShowTooltip": "Only past confirmed bookings can be marked no-show",
    "confirmSuccess": "{count} bookings confirmed",
    "cancelSuccess": "{count} bookings cancelled",
    "noShowSuccess": "{count} bookings marked no-show",
    "exportSuccess": "CSV exported",
    "actionError": "Could not complete the action. Please try again."
  },
  "detail": {
    "quickActions": {
      "confirm": "Confirm",
      "addPayment": "+ Payment",
      "cancel": "Cancel",
      "markCompleted": "Mark as completed",
      "markNoShow": "Mark no-show",
      "reactivate": "Reactivate",
      "copyLink": "Copy link",
      "print": "Print",
      "more": "More actions"
    },
    "sectionCustomer": "Customer",
    "sectionLocation": "Location",
    "sectionNotes": "Notes",
    "activityTitle": "Activity",
    "activityCreated": "Booking created",
    "activityPayment": "Payment of {amount} recorded",
    "activityRefund": "Refund of {amount}",
    "linesAndPayments": "Lines and payments",
    "subtotal": "Subtotal",
    "paid": "Paid",
    "remaining": "Remaining"
  }
}
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/lib/i18n/es.json','utf8')); JSON.parse(require('fs').readFileSync('src/lib/i18n/en.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 4: Type-check (dictionaries are typed via TS inference)**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/es.json src/lib/i18n/en.json
git commit -m "Add i18n keys for bookings list and detail redesign"
```

---

## Task 9: Install sonner + shadcn Checkbox, wire Toaster into dashboard layout

**Files:**
- Modify: `package.json` (via shadcn CLI)
- Create: `src/components/ui/sonner.tsx` (via shadcn CLI)
- Create: `src/components/ui/checkbox.tsx` (via shadcn CLI)
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Install the components via the shadcn CLI**

```bash
npx shadcn@latest add sonner checkbox
```

Expected: files created at `src/components/ui/sonner.tsx` and `src/components/ui/checkbox.tsx`; dependencies `sonner` and `@radix-ui/react-checkbox` (or the unified `radix-ui`) added.

- [ ] **Step 2: Read the dashboard layout to find the insertion point**

```bash
cat src/app/\(dashboard\)/layout.tsx
```

Note the existing root element of the layout (likely a `<div>` or fragment wrapping `{children}`).

- [ ] **Step 3: Add `<Toaster />` to the dashboard layout**

Edit `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/layout.tsx`. Import the toaster:

```tsx
import { Toaster } from "@/components/ui/sonner";
```

And render `<Toaster richColors position="top-right" />` as a sibling of `{children}` inside the layout's root element. (Exact spot depends on current layout; place it where it'll be on every dashboard page, once.)

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/ui/sonner.tsx src/components/ui/checkbox.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "Add sonner toaster and checkbox primitives for dashboard"
```

---

## Task 10: Bulk Server Actions — `confirmBookings`, `cancelBookings`, `markBookingsNoShow`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions.ts`

Study the existing `updateBookingStatus` in that file (lines 66-100) — the pattern is: auth → tenant lookup → mutation → revalidate. The bulk versions follow the same pattern with two differences: (1) `id IN (bookingIds)` instead of `eq('id', ...)`, and (2) a critical tenant-isolation guard via the resource join.

- [ ] **Step 1: Append the new actions to `actions.ts`**

Add at the end of `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions.ts`:

```ts
// --------------------------------------------------------------
// Bulk actions for the list page
// --------------------------------------------------------------

import type { ActionResult } from "./_lib/types";

async function authenticateAndLoadTenant(tenantSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" as const };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();
  if (!tenant) return { error: "Tenant no encontrado" as const };

  return { supabase, user, tenantId: tenant.id };
}

/**
 * Loads bookingIds belonging to the tenant, restricted to the allowed
 * starting statuses. Returns the subset of ids the caller is authorized
 * to mutate. This is the single tenant-isolation guard for every bulk
 * action — never UPDATE without going through this filter.
 */
async function filterBookingsForTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  bookingIds: string[],
  allowedStatuses: BookingStatus[]
): Promise<string[]> {
  if (bookingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("id, resource:resources!inner(tenant_id), status")
    .in("id", bookingIds)
    .eq("resource.tenant_id", tenantId)
    .in("status", allowedStatuses);
  if (error || !data) return [];
  return data.map((row) => row.id);
}

export async function confirmBookings(
  tenantSlug: string,
  bookingIds: string[]
): Promise<ActionResult> {
  const ctx = await authenticateAndLoadTenant(tenantSlug);
  if ("error" in ctx) return { success: false, error: ctx.error };

  const allowedIds = await filterBookingsForTenant(
    ctx.supabase,
    ctx.tenantId,
    bookingIds,
    ["pending"]
  );
  if (allowedIds.length === 0) {
    return { success: false, error: "Ninguna reserva elegible para confirmar" };
  }

  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .in("id", allowedIds);

  if (error) {
    return { success: false, error: "No se pudo confirmar. Intenta de nuevo." };
  }

  // Fire-and-forget email notifications for each confirmed booking.
  // Notifier errors are swallowed — email is a best-effort side channel.
  await Promise.all(
    allowedIds.map((id) =>
      notifyBookingStatusChange(ctx.supabase, id, "confirmed").catch(() => {})
    )
  );

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { success: true, affectedCount: allowedIds.length };
}

export async function cancelBookings(
  tenantSlug: string,
  bookingIds: string[]
): Promise<ActionResult> {
  const ctx = await authenticateAndLoadTenant(tenantSlug);
  if ("error" in ctx) return { success: false, error: ctx.error };

  // Cancel is allowed from pending or confirmed; blocked for terminal states.
  const allowedIds = await filterBookingsForTenant(
    ctx.supabase,
    ctx.tenantId,
    bookingIds,
    ["pending", "confirmed"]
  );
  if (allowedIds.length === 0) {
    return { success: false, error: "Ninguna reserva elegible para cancelar" };
  }

  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .in("id", allowedIds);

  if (error) {
    return { success: false, error: "No se pudo cancelar. Intenta de nuevo." };
  }

  await Promise.all(
    allowedIds.map((id) =>
      notifyBookingStatusChange(ctx.supabase, id, "cancelled").catch(() => {})
    )
  );

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { success: true, affectedCount: allowedIds.length };
}

export async function markBookingsNoShow(
  tenantSlug: string,
  bookingIds: string[]
): Promise<ActionResult> {
  const ctx = await authenticateAndLoadTenant(tenantSlug);
  if ("error" in ctx) return { success: false, error: ctx.error };

  // No-show is only valid for past confirmed bookings. We enforce the
  // "past" constraint via a secondary check here (the simple
  // filterBookingsForTenant only checks status).
  if (bookingIds.length === 0) {
    return { success: false, error: "Ninguna reserva seleccionada" };
  }

  const { data: eligible } = await ctx.supabase
    .from("bookings")
    .select("id, resource:resources!inner(tenant_id), status, start_time")
    .in("id", bookingIds)
    .eq("resource.tenant_id", ctx.tenantId)
    .eq("status", "confirmed")
    .lt("start_time", new Date().toISOString());

  const allowedIds = (eligible ?? []).map((r) => r.id);
  if (allowedIds.length === 0) {
    return {
      success: false,
      error: "Ninguna reserva elegible para marcar como no-show",
    };
  }

  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: "no_show" })
    .in("id", allowedIds);

  if (error) {
    return {
      success: false,
      error: "No se pudo marcar como no-show. Intenta de nuevo.",
    };
  }

  await Promise.all(
    allowedIds.map((id) =>
      notifyBookingStatusChange(ctx.supabase, id, "no_show").catch(() => {})
    )
  );

  revalidatePath(`/dashboard/${tenantSlug}/bookings`);
  return { success: true, affectedCount: allowedIds.length };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors. (The `import type { ActionResult }` mid-file is fine because TS allows non-top imports in server actions files; if ESLint complains, move it to the top with the other imports.)

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions.ts"
git commit -m "Add confirmBookings, cancelBookings, markBookingsNoShow bulk actions"
```

---

## Task 11: CSV export route handler

**Why a route handler, not a Server Action:** Server Actions can't stream a `Response` with a `Content-Disposition` header as the navigation target. A route handler is the cleanest way to return a downloadable CSV. Tenant scoping and authorization mirror the bulk-action pattern.

**Files:**
- Create: `src/app/api/tenants/[tenantSlug]/bookings/export/route.ts`

- [ ] **Step 1: Create the route handler**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/api/tenants/[tenantSlug]/bookings/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingsToCsv, type CsvBookingRow } from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/csv";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }

  let body: { bookingIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const bookingIds = Array.isArray(body.bookingIds)
    ? body.bookingIds.filter((x): x is string => typeof x === "string")
    : [];
  if (bookingIds.length === 0) {
    return NextResponse.json(
      { error: "bookingIds requeridos" },
      { status: 400 }
    );
  }

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(
      `
      booking_number,
      start_time,
      duration_hours,
      total_price,
      paid_amount,
      payment_status,
      status,
      resource:resources!inner(name, tenant_id),
      location:locations(name, timezone),
      booker:bookers!inner(name, email, phone)
    `
    )
    .in("id", bookingIds)
    .eq("resource.tenant_id", tenant.id)
    .order("start_time", { ascending: false });

  if (error || !rows) {
    return NextResponse.json(
      { error: "No se pudo exportar" },
      { status: 500 }
    );
  }

  const csvRows: CsvBookingRow[] = rows.map((row) => {
    const resource = row.resource as unknown as { name: string };
    const location = row.location as unknown as {
      name: string;
      timezone: string;
    } | null;
    const booker = row.booker as unknown as {
      name: string;
      email: string;
      phone: string | null;
    };
    return {
      booking_number: row.booking_number,
      start_time: row.start_time,
      duration_hours: row.duration_hours,
      total_price: row.total_price,
      paid_amount: row.paid_amount,
      payment_status: row.payment_status,
      status: row.status,
      resource_name: resource.name,
      location_name: location?.name ?? null,
      location_timezone: location?.timezone ?? "America/Santiago",
      booker_name: booker.name,
      booker_email: booker.email,
      booker_phone: booker.phone,
    };
  });

  const csv = bookingsToCsv(csvRows);
  const filename = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/tenants/[tenantSlug]/bookings/export/route.ts"
git commit -m "Add CSV export route handler for bookings list"
```

---

## Task 12: Scaffold `page.tsx`, `bookings-header.tsx`, `bookings-empty-state.tsx`

**Why scaffold first:** We replace the current 230-line `page.tsx` with a thin orchestrator so the rest of the components can be dropped in independently. The header and empty state are the simplest — we start there.

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-header.tsx`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-empty-state.tsx`
- Modify: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx`

- [ ] **Step 1: Create `bookings-header.tsx` (server component)**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-header.tsx`:

```tsx
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function BookingsHeader({
  filteredCount,
  totalCount,
}: {
  filteredCount: number;
  totalCount: number;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const list = d.bookingsList;

  const summary = list.countSummary
    .replace("{current}", String(filteredCount))
    .replace("{total}", String(totalCount));

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{d.bookings}</h1>
      <p className="text-sm text-muted-foreground mt-1">{summary}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `bookings-empty-state.tsx` (server component)**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-empty-state.tsx`:

```tsx
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function BookingsEmptyState({
  searchQuery,
}: {
  searchQuery: string;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const list = dict.dashboard.bookingsList;

  const message = searchQuery
    ? list.noResultsSearch.replace("{query}", searchQuery)
    : list.noResultsFilter;

  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
```

- [ ] **Step 3: Temporarily rewrite `page.tsx` to wire in only the header and empty state**

**Important:** keep all existing behavior (auth, tenant lookup, booking query, table) for now. Only wrap it in the new `BookingsHeader`. This keeps the app functional between tasks — no broken state committed. Full rewrite happens in Task 19.

Replace the existing `return (...)` block in `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx` so the page still renders bookings but with the new header. The old `<h1>` heading is replaced by the new `<BookingsHeader>` component. Also add the total-tenant-count query so we can pass both numbers.

At the top of the file add:

```tsx
import { BookingsHeader } from "./_components/bookings-header";
```

Below the existing `bookings` query, add:

```tsx
  // Total bookings for the tenant (used by the header subtitle).
  const { count: totalCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("resource.tenant_id", tenant.id);
```

Replace the existing:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">{d.bookings}</h1>
</div>
```

with:

```tsx
<BookingsHeader
  filteredCount={bookings?.length ?? 0}
  totalCount={totalCount ?? 0}
/>
```

- [ ] **Step 4: Smoke test the page manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/<your-seeded-tenant-slug>/bookings`. Expected: the page renders, the header shows "X de Y reservas", and the existing table still appears below.

- [ ] **Step 5: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-header.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-empty-state.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx"
git commit -m "Scaffold bookings header and empty state components"
```

---

## Task 13: `bookings-omnibox.tsx` (client)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-omnibox.tsx`

- [ ] **Step 1: Create the component**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-omnibox.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";

const DEBOUNCE_MS = 250;

export function BookingsOmnibox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dashboard } = useDict();
  const list = dashboard.bookingsList;

  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep internal state in sync when the URL is changed from elsewhere
  // (e.g. the user clicks "Clear filters" or navigates via back button).
  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    // Any filter change resets pagination.
    params.delete("page");
    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => commit(next.trim()), DEBOUNCE_MS);
  }

  return (
    <div className="relative mb-6">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={list.searchPlaceholder}
        className="pl-9 pr-9"
        aria-label={list.searchPlaceholder}
      />
      {isPending && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`**

Import at the top of `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx`:

```tsx
import { BookingsOmnibox } from "./_components/bookings-omnibox";
```

Render it immediately after `<BookingsHeader ... />`:

```tsx
<BookingsHeader ... />
<BookingsOmnibox />
```

- [ ] **Step 3: Smoke test manually**

```bash
npm run dev
```

Navigate to the bookings page, type in the omnibox. Expected: URL updates with `?q=...` after a short debounce; page re-renders (no filtering happens yet because the query builder isn't wired up — that's Task 19).

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-omnibox.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx"
git commit -m "Add debounced omnibox search for bookings list"
```

---

## Task 14: `bookings-tabs.tsx` (client)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-tabs.tsx`

- [ ] **Step 1: Create the component**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/dict-context";
import {
  BOOKING_TABS,
  type BookingTab,
  type CountsByTab,
} from "../_lib/types";

export function BookingsTabs({ counts }: { counts: CountsByTab }) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as BookingTab) ?? "all";
  const { dashboard } = useDict();
  const tabLabels = dashboard.bookingsList.tabs;

  function hrefForTab(tab: BookingTab): string {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    params.delete("page"); // Always reset pagination on tab change
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  function formatCount(count: number | null): string {
    if (count === null) return "(—)";
    return `(${count})`;
  }

  return (
    <nav
      aria-label="Bookings tabs"
      className="mb-6 overflow-x-auto border-b"
    >
      <ul className="flex gap-4 whitespace-nowrap">
        {BOOKING_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <li key={tab}>
              <Link
                href={hrefForTab(tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-block py-3 px-1 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tabLabels[tab]}{" "}
                <span className="tabular-nums text-xs">
                  {formatCount(counts[tab])}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Pass a placeholder counts object from `page.tsx`**

In `page.tsx`, add after the other queries (the real counts query happens in Task 19):

```tsx
import { BookingsTabs } from "./_components/bookings-tabs";
import type { CountsByTab } from "./_lib/types";
```

And near the render:

```tsx
const placeholderCounts: CountsByTab = {
  all: null,
  pending: null,
  unpaid: null,
  upcoming: null,
  past_due: null,
  archived: null,
};
```

Render:

```tsx
<BookingsHeader ... />
<BookingsOmnibox />
<BookingsTabs counts={placeholderCounts} />
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Navigate to the bookings page. Expected: tab strip appears with all six tabs underlined, each showing `(—)` counts, the "Todas" tab active. Clicking a tab updates the URL.

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-tabs.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx"
git commit -m "Add queue tab strip with live count placeholders"
```

---

## Task 15: `bookings-filter-bar.tsx` (client)

**Scope note:** We implement the four chips (date, location, resource, add-ons) with Popover-based single-selects. The date chip uses the existing `Calendar` component from `src/components/ui/calendar.tsx` in a simple range mode. Mobile Sheet collapse is included in the same file.

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-filter-bar.tsx`

- [ ] **Step 1: Create the component**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-filter-bar.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Filter, X } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";
import { cn } from "@/lib/utils";

type LocationOption = { id: string; name: string };
type ResourceOption = { id: string; name: string; location_ids: string[] };

type Props = {
  locations: LocationOption[];
  resources: ResourceOption[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingsFilterBar({ locations, resources }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dashboard } = useDict();
  const f = dashboard.bookingsList.filters;
  const list = dashboard.bookingsList;

  const activeLocation = searchParams.get("location");
  const activeResource = searchParams.get("resource");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const hasAddOns = searchParams.get("has_add_ons");

  const visibleResources = activeLocation
    ? resources.filter((r) => r.location_ids.includes(activeLocation))
    : resources;

  function updateParams(
    updater: (params: URLSearchParams) => void
  ): void {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function setLocation(id: string | null) {
    updateParams((params) => {
      if (id) params.set("location", id);
      else params.delete("location");
      // Clear resource if it no longer belongs to the new location.
      if (activeResource) {
        const stillValid = resources.find(
          (r) => r.id === activeResource && (!id || r.location_ids.includes(id))
        );
        if (!stillValid) params.delete("resource");
      }
    });
  }

  function setResource(id: string | null) {
    updateParams((params) => {
      if (id) params.set("resource", id);
      else params.delete("resource");
    });
  }

  function setDateRange(from: Date | null, to: Date | null) {
    updateParams((params) => {
      if (from) params.set("from", toIsoDate(from));
      else params.delete("from");
      if (to) params.set("to", toIsoDate(to));
      else params.delete("to");
    });
  }

  function cycleAddOns() {
    updateParams((params) => {
      // Cycle: unset → "1" (with) → "0" (without) → unset
      if (hasAddOns === null) params.set("has_add_ons", "1");
      else if (hasAddOns === "1") params.set("has_add_ons", "0");
      else params.delete("has_add_ons");
    });
  }

  function clearAll() {
    router.replace("?");
  }

  const isFiltered =
    !!activeLocation ||
    !!activeResource ||
    !!fromDate ||
    !!toDate ||
    !!hasAddOns ||
    !!searchParams.get("q") ||
    !!searchParams.get("tab");

  const locationLabel =
    locations.find((l) => l.id === activeLocation)?.name ?? f.locationAll;
  const resourceLabel =
    visibleResources.find((r) => r.id === activeResource)?.name ??
    f.resourceAll;
  const dateLabel =
    fromDate && toDate
      ? `${fromDate} — ${toDate}`
      : fromDate
        ? `${fromDate} →`
        : toDate
          ? `→ ${toDate}`
          : f.dateAll;
  const addOnsLabel =
    hasAddOns === "1"
      ? f.addOnsWith
      : hasAddOns === "0"
        ? f.addOnsWithout
        : f.addOnsAll;

  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date chip */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {f.date}: {dateLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={{
              from: fromDate && ISO_DATE_RE.test(fromDate)
                ? new Date(fromDate + "T00:00:00")
                : undefined,
              to: toDate && ISO_DATE_RE.test(toDate)
                ? new Date(toDate + "T00:00:00")
                : undefined,
            }}
            onSelect={(range) => {
              setDateRange(range?.from ?? null, range?.to ?? null);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Location chip */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {f.location}: {locationLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1">
          <button
            type="button"
            className={cn(
              "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
              !activeLocation && "font-medium"
            )}
            onClick={() => setLocation(null)}
          >
            {f.locationAll}
          </button>
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                activeLocation === loc.id && "font-medium"
              )}
              onClick={() => setLocation(loc.id)}
            >
              {loc.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Resource chip */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {f.resource}: {resourceLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1">
          <button
            type="button"
            className={cn(
              "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
              !activeResource && "font-medium"
            )}
            onClick={() => setResource(null)}
          >
            {f.resourceAll}
          </button>
          {visibleResources.map((res) => (
            <button
              key={res.id}
              type="button"
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                activeResource === res.id && "font-medium"
              )}
              onClick={() => setResource(res.id)}
            >
              {res.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Add-ons tri-state chip */}
      <Button
        variant="outline"
        size="sm"
        onClick={cycleAddOns}
        className={cn(hasAddOns && "border-primary text-primary")}
      >
        {addOnsLabel}
        {hasAddOns && <X className="ml-1 h-3 w-3" />}
      </Button>

      {isFiltered && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {list.clearFilters}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: inline filter bar */}
      <div className="mb-6 hidden md:block">{chips}</div>

      {/* Mobile: single "Filtros" button opening a Sheet */}
      <div className="mb-6 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{chips}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Load locations + resources in `page.tsx` and pass them**

In `page.tsx`, after the tenant lookup, add:

```tsx
  const [{ data: locations }, { data: resourceRows }] = await Promise.all([
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
```

Import at top:

```tsx
import { BookingsFilterBar } from "./_components/bookings-filter-bar";
```

Render after the tabs:

```tsx
<BookingsTabs counts={placeholderCounts} />
<BookingsFilterBar
  locations={locationOptions}
  resources={resourceOptions}
/>
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Expected: four filter chips render below the tab strip. Clicking location shows the tenant's locations. Selecting one updates the URL. The resource list narrows to match. Cycling the add-ons chip changes its label.

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-filter-bar.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx"
git commit -m "Add filter bar with date, location, resource, add-ons chips"
```

---

## Task 16: `bookings-table.tsx` + `bookings-row.tsx` (server)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-row.tsx`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-table.tsx`

- [ ] **Step 1: Create `bookings-row.tsx`**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-row.tsx`:

```tsx
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { BookingRowCheckbox } from "./bookings-row-checkbox";
import type { BookingRow } from "../_lib/types";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

type Props = {
  row: BookingRow;
  tenantSlug: string;
  locale: "es" | "en";
  statusLabel: string;
  paymentLabel: string;
};

function formatDateTime(iso: string, tz: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
    .format(new Date(iso))
    .replace(/[\u202F\u00A0]/g, " ");
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function BookingsTableRow({
  row,
  tenantSlug,
  locale,
  statusLabel,
  paymentLabel,
}: Props) {
  const tz = row.location?.timezone ?? "America/Santiago";
  const detailHref = `/dashboard/${tenantSlug}/bookings/${row.id}`;

  return (
    <TableRow className="group">
      <TableCell className="w-[44px]">
        <BookingRowCheckbox bookingId={row.id} status={row.status} />
      </TableCell>
      <TableCell className="font-mono tabular-nums text-muted-foreground">
        <Link href={detailHref} className="hover:underline">
          #{row.booking_number}
        </Link>
      </TableCell>
      <TableCell>
        <Link href={detailHref} className="block hover:underline">
          <div className="whitespace-nowrap">
            {formatDateTime(row.start_time, tz, locale)}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {row.resource.name} · {row.location?.name ?? "—"}
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Link href={detailHref} className="block hover:underline">
          <div className="font-medium">{row.booker.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.booker.email}
          </div>
        </Link>
      </TableCell>
      <TableCell className="tabular-nums text-center">
        {row.duration_hours}h
      </TableCell>
      <TableCell className="tabular-nums text-right">
        {formatCLP(row.total_price)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 items-start">
          <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
            {statusLabel}
          </Badge>
          <PaymentStatusBadge
            status={row.payment_status}
            label={paymentLabel}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 2: Create `bookings-row-checkbox.tsx` (small client island)**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-row-checkbox.tsx`:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useBookingsSelection } from "./bookings-selection-context";
import type { BookingStatus } from "../_lib/types";

export function BookingRowCheckbox({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const { selected, toggle } = useBookingsSelection();
  const checked = selected.has(bookingId);

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => toggle(bookingId, status)}
      aria-label={`Seleccionar reserva ${bookingId}`}
    />
  );
}
```

*(The `bookings-selection-context` file is created in Task 18 — for now, this file will fail to import. We create a stub in the next step so intermediate commits type-check.)*

- [ ] **Step 3: Create a stub selection context so the table compiles now**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-selection-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BookingStatus } from "../_lib/types";

type SelectionMap = Map<string, BookingStatus>;

type SelectionContextValue = {
  selected: SelectionMap;
  toggle: (id: string, status: BookingStatus) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function BookingsSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<SelectionMap>(new Map());

  function toggle(id: string, status: BookingStatus) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, status);
      return next;
    });
  }

  function clear() {
    setSelected(new Map());
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle, clear }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useBookingsSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      "useBookingsSelection must be used inside BookingsSelectionProvider"
    );
  }
  return ctx;
}
```

Task 18 will extend this with the bulk action bar consumer.

- [ ] **Step 4: Create `bookings-table.tsx`**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { BookingsTableRow } from "./bookings-row";
import type { BookingRow } from "../_lib/types";

export async function BookingsTable({
  rows,
  tenantSlug,
}: {
  rows: BookingRow[];
  tenantSlug: string;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const list = d.bookingsList;
  const statusLabels = d.statusLabels as Record<string, string>;
  const paymentLabels = d.paymentLabels as Record<string, string>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px]" />
            <TableHead className="w-[80px]">{list.columns.number}</TableHead>
            <TableHead>{list.columns.when}</TableHead>
            <TableHead>{list.columns.customer}</TableHead>
            <TableHead className="text-center">
              {list.columns.duration}
            </TableHead>
            <TableHead className="text-right">{list.columns.total}</TableHead>
            <TableHead>{list.columns.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <BookingsTableRow
              key={row.id}
              row={row}
              tenantSlug={tenantSlug}
              locale={locale === "en" ? "en" : "es"}
              statusLabel={statusLabels[row.status] ?? row.status}
              paymentLabel={
                paymentLabels[row.payment_status] ?? row.payment_status
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 5: Type-check + lint (not wired into page yet)**

```bash
npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-row.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-row-checkbox.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-selection-context.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-table.tsx"
git commit -m "Add bookings table with two-line rows and stacked status pills"
```

---

## Task 17: `bookings-pagination.tsx` (client)

**Files:**
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-pagination.tsx`

- [ ] **Step 1: Create the component**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-pagination.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";
import { PAGE_SIZE } from "../_lib/types";

export function BookingsPagination({ total }: { total: number }) {
  const searchParams = useSearchParams();
  const { dashboard } = useDict();
  const pag = dashboard.bookingsList.pagination;

  const currentPage = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (totalPages <= 1) return null;

  function hrefForPage(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  const label = pag.pageOf
    .replace("{current}", String(currentPage))
    .replace("{total}", String(totalPages));

  return (
    <div className="mt-4 flex items-center justify-end gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild={currentPage > 1}
          disabled={currentPage <= 1}
        >
          {currentPage > 1 ? (
            <Link href={hrefForPage(currentPage - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {pag.previous}
            </Link>
          ) : (
            <span>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {pag.previous}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild={currentPage < totalPages}
          disabled={currentPage >= totalPages}
        >
          {currentPage < totalPages ? (
            <Link href={hrefForPage(currentPage + 1)}>
              {pag.next}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <span>
              {pag.next}
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-pagination.tsx"
git commit -m "Add prev/next pagination control for bookings list"
```

---

## Task 18: Extend selection context + `bookings-bulk-action-bar.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-selection-context.tsx`
- Create: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-bulk-action-bar.tsx`

- [ ] **Step 1: Extend the selection context with optimistic status overrides**

Replace the body of `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-selection-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useOptimistic,
  startTransition,
  type ReactNode,
} from "react";
import type { BookingStatus } from "../_lib/types";

type SelectionMap = Map<string, BookingStatus>;

/**
 * Map of bookingId → optimistic status override. Set by the bulk action
 * bar when the user clicks Confirm / Cancel / No-show. The `BookingsRow`
 * doesn't read from this directly — it would require a round-trip change
 * to the server-rendered rows. Instead, the bulk action bar handles the
 * transition and lets `revalidatePath` catch the UI up.
 *
 * We still expose the map so future consumers (e.g. an inline row pill
 * override) can read from it if needed.
 */
type OptimisticOverrides = Map<string, BookingStatus>;

type SelectionContextValue = {
  selected: SelectionMap;
  toggle: (id: string, status: BookingStatus) => void;
  clear: () => void;
  optimisticOverrides: OptimisticOverrides;
  applyOptimistic: (ids: string[], next: BookingStatus) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function BookingsSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<SelectionMap>(new Map());
  const [optimisticOverrides, setOptimisticOverrides] = useOptimistic<
    OptimisticOverrides,
    { ids: string[]; next: BookingStatus }
  >(new Map(), (current, { ids, next }) => {
    const out = new Map(current);
    for (const id of ids) out.set(id, next);
    return out;
  });

  function toggle(id: string, status: BookingStatus) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, status);
      return next;
    });
  }

  function clear() {
    setSelected(new Map());
  }

  function applyOptimistic(ids: string[], next: BookingStatus) {
    startTransition(() => {
      setOptimisticOverrides({ ids, next });
    });
  }

  return (
    <SelectionContext.Provider
      value={{
        selected,
        toggle,
        clear,
        optimisticOverrides,
        applyOptimistic,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useBookingsSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      "useBookingsSelection must be used inside BookingsSelectionProvider"
    );
  }
  return ctx;
}
```

- [ ] **Step 2: Create the bulk action bar**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-bulk-action-bar.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDict } from "@/lib/i18n/dict-context";
import { useBookingsSelection } from "./bookings-selection-context";
import {
  confirmBookings,
  cancelBookings,
  markBookingsNoShow,
} from "../actions";
import type { BookingStatus } from "../_lib/types";

export function BookingsBulkActionBar({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const { selected, clear, applyOptimistic } = useBookingsSelection();
  const { dashboard } = useDict();
  const bulk = dashboard.bookingsList.bulk;
  const [isPending, startTransition] = useTransition();

  const count = selected.size;
  if (count === 0) return null;

  const selectedIds = Array.from(selected.keys());
  const selectedStatuses = Array.from(selected.values());

  const canConfirm = selectedStatuses.every((s) => s === "pending");
  const canCancel = selectedStatuses.every(
    (s) => s === "pending" || s === "confirmed"
  );
  // "No-show" requires knowing whether start_time is past. We can't check
  // that from the client without extra data; server guard enforces it.
  // Enable whenever all are 'confirmed'; server will reject future ones.
  const canNoShow = selectedStatuses.every((s) => s === "confirmed");

  function runAction(
    action: (
      tenantSlug: string,
      ids: string[]
    ) => Promise<{ success: boolean; affectedCount?: number; error?: string }>,
    optimisticStatus: BookingStatus,
    successKey: "confirmSuccess" | "cancelSuccess" | "noShowSuccess"
  ) {
    applyOptimistic(selectedIds, optimisticStatus);
    startTransition(async () => {
      const result = await action(tenantSlug, selectedIds);
      if (result.success) {
        toast.success(
          bulk[successKey].replace(
            "{count}",
            String(result.affectedCount ?? selectedIds.length)
          )
        );
        clear();
      } else {
        toast.error(result.error ?? bulk.actionError);
      }
    });
  }

  async function exportCsv() {
    try {
      const res = await fetch(
        `/api/tenants/${tenantSlug}/bookings/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingIds: selectedIds }),
        }
      );
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(bulk.exportSuccess);
    } catch {
      toast.error(bulk.actionError);
    }
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2 rounded-md border bg-muted/60 px-4 py-3"
      aria-live="polite"
    >
      <span className="text-sm font-medium">
        {bulk.selected.replace("{count}", String(count))}
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={!canConfirm || isPending}
          onClick={() =>
            runAction(confirmBookings, "confirmed", "confirmSuccess")
          }
          title={!canConfirm ? bulk.cannotConfirmTooltip : undefined}
        >
          {bulk.confirm}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canCancel || isPending}
          onClick={() =>
            runAction(cancelBookings, "cancelled", "cancelSuccess")
          }
        >
          {bulk.cancel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canNoShow || isPending}
          onClick={() =>
            runAction(markBookingsNoShow, "no_show", "noShowSuccess")
          }
          title={!canNoShow ? bulk.cannotNoShowTooltip : undefined}
        >
          {bulk.noShow}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={exportCsv}
        >
          {bulk.export}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={isPending}
        >
          {bulk.deselect}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-selection-context.tsx" "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_components/bookings-bulk-action-bar.tsx"
git commit -m "Add bulk action bar with useOptimistic transitions and CSV export"
```

---

## Task 19: Wire everything into `page.tsx` and delete legacy layout

**This is the integration task.** We replace the current `page.tsx` body with the orchestrated version using `buildBookingsQuery` + `buildCountsQuery` + the new components.

**Files:**
- Rewrite: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx`

- [ ] **Step 1: Replace `page.tsx` with the integrated version**

Replace the entire contents of `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "./_lib/filters";
import {
  buildBookingsQuery,
  buildCountsQuery,
  resolveCounts,
} from "./_lib/queries";
import type { BookingRow } from "./_lib/types";
import { BookingsHeader } from "./_components/bookings-header";
import { BookingsOmnibox } from "./_components/bookings-omnibox";
import { BookingsTabs } from "./_components/bookings-tabs";
import { BookingsFilterBar } from "./_components/bookings-filter-bar";
import { BookingsTable } from "./_components/bookings-table";
import { BookingsEmptyState } from "./_components/bookings-empty-state";
import { BookingsPagination } from "./_components/bookings-pagination";
import { BookingsBulkActionBar } from "./_components/bookings-bulk-action-bar";
import { BookingsSelectionProvider } from "./_components/bookings-selection-context";

export const metadata: Metadata = { title: "Reservas" };

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingsPage({
  params,
  searchParams,
}: PageProps) {
  const { tenantSlug } = await params;
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams);

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

  const now = new Date();

  // Fetch rows, counts, and filter dropdown data in parallel.
  const [
    listResult,
    countsDict,
    { data: totalCountRows },
    { data: locations },
    { data: resourceRows },
  ] = await Promise.all([
    buildBookingsQuery(supabase, tenant.id, filters, now),
    Promise.resolve(buildCountsQuery(supabase, tenant.id, filters, now)),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
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

  const counts = await resolveCounts(countsDict);
  // The main list result is either a PostgREST response or an RPC response.
  // Both expose `data` and `count`; we normalize here.
  const rows = ((listResult as unknown as { data: BookingRow[] | null }).data ??
    []) as BookingRow[];
  const filteredCount =
    (listResult as unknown as { count: number | null }).count ?? rows.length;
  const totalCount =
    (totalCountRows as unknown as { count: number | null } | null)?.count ?? 0;

  const locationOptions = locations ?? [];
  const resourceOptions = (resourceRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    location_ids: (r.resource_locations ?? []).map(
      (rl: { location_id: string }) => rl.location_id
    ),
  }));

  return (
    <BookingsSelectionProvider>
      <div className="p-6">
        <BookingsHeader
          filteredCount={filteredCount}
          totalCount={totalCount}
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
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors. If Supabase's typed result surface causes friction on the normalization cast (`listResult as unknown as ...`), verify by checking that `listResult` is in fact thenable — both the RPC and the table select return thenables that resolve to `{ data, count, error }`.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Walk through:
- Land on `/dashboard/<slug>/bookings` — default "Todas" tab, filter bar, table, pagination all visible.
- Click "Pendientes" → URL updates, rows narrow.
- Type in omnibox → rows narrow (or empty state if no match).
- Toggle add-ons chip → rows narrow.
- Select 2 rows → bulk action bar appears.
- Click "Confirmar" → toast, rows update (after revalidate).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/page.tsx"
git commit -m "Wire new bookings page with filters, tabs, table, bulk actions"
```

---

## Task 20: `booking-quick-actions.tsx` (detail page quick-action rail)

**Files:**
- Create: `src/components/dashboard/booking-quick-actions.tsx`

- [ ] **Step 1: Create the component**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/src/components/dashboard/booking-quick-actions.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { updateBookingStatus } from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions";
import type { Database } from "@/lib/supabase/database.types";
import { useDict } from "@/lib/i18n/dict-context";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

type Props = {
  tenantSlug: string;
  bookingId: string;
  status: BookingStatus;
  startTime: string;
};

export function BookingQuickActions({
  tenantSlug,
  bookingId,
  status,
  startTime,
}: Props) {
  const { dashboard } = useDict();
  const qa = dashboard.bookingsList.detail.quickActions;
  const [isPending, startTransition] = useTransition();

  const isPastStart = new Date(startTime).getTime() < Date.now();

  function run(next: BookingStatus) {
    startTransition(async () => {
      const result = await updateBookingStatus(tenantSlug, bookingId, next);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success(qa.copyLink);
  }

  // Primary button set depends on the current status.
  const primaryButtons: { label: string; action: () => void; variant?: "default" | "outline" | "destructive" }[] = [];
  if (status === "pending") {
    primaryButtons.push(
      { label: qa.confirm, action: () => run("confirmed"), variant: "default" },
      { label: qa.cancel, action: () => run("cancelled"), variant: "outline" }
    );
  } else if (status === "confirmed" && !isPastStart) {
    primaryButtons.push(
      { label: qa.cancel, action: () => run("cancelled"), variant: "outline" }
    );
  } else if (status === "confirmed" && isPastStart) {
    primaryButtons.push(
      {
        label: qa.markCompleted,
        action: () => run("completed"),
        variant: "default",
      },
      { label: qa.markNoShow, action: () => run("no_show"), variant: "outline" }
    );
  }
  // completed / cancelled / no_show: no primary buttons, only the dropdown.

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {primaryButtons.map((b) => (
        <Button
          key={b.label}
          size="sm"
          variant={b.variant ?? "outline"}
          onClick={b.action}
          disabled={isPending}
        >
          {b.label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            aria-label={qa.more}
            disabled={isPending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>{qa.copyLink}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.print()}>
            {qa.print}
          </DropdownMenuItem>
          {status === "cancelled" && (
            <DropdownMenuItem onClick={() => run("pending")}>
              {qa.reactivate}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/booking-quick-actions.tsx
git commit -m "Add context-aware quick-action rail for booking detail page"
```

---

## Task 21: Detail page refactor — 5 targeted fixes

**Files:**
- Rewrite: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/[bookingId]/page.tsx`

The current file is ~320 lines with two stacked info cards and a separate Payments card. We replace it with: stronger header → quick action rail → two-column grid (main content + compact sidebar) → consolidated "lines and payments" block → inferred activity timeline.

- [ ] **Step 1: Replace the entire file**

Replace the contents of `/Users/benjaminjacksoncevasco/bukarrum-v0/src/app/(dashboard)/dashboard/[tenantSlug]/bookings/[bookingId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { BookingQuickActions } from "@/components/dashboard/booking-quick-actions";
import {
  BookingPaymentPanel,
  type BookingPaymentRow,
} from "@/components/dashboard/booking-payment-panel";

export const metadata: Metadata = { title: "Reserva" };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; bookingId: string }>;
}) {
  const { tenantSlug, bookingId } = await params;
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

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      start_time,
      end_time,
      duration_hours,
      total_price,
      paid_amount,
      payment_status,
      status,
      notes,
      created_at,
      resource:resources!inner(
        id,
        name,
        tenant_id,
        hourly_rate
      ),
      location:locations(
        id,
        name,
        address,
        timezone
      ),
      booker:bookers!inner(
        id,
        name,
        email,
        phone
      ),
      add_ons:booking_add_ons(
        id,
        price,
        add_on:add_on_services(name, pricing_mode, unit_price)
      ),
      payments:booking_payments(
        id,
        amount,
        entry_type,
        method,
        paid_at,
        reference,
        notes
      )
    `
    )
    .eq("id", bookingId)
    .eq("resource.tenant_id", tenant.id)
    .single();

  if (!booking) notFound();

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const detail = d.bookingDetail as Record<string, string>;
  const list = d.bookingsList;
  const statusLabels = d.statusLabels as Record<string, string>;
  const paymentLabels = d.paymentLabels as Record<string, string>;

  const resource = booking.resource as unknown as {
    id: string;
    name: string;
    hourly_rate: number;
  };
  const location = booking.location as unknown as {
    id: string;
    name: string;
    address: string | null;
    timezone: string;
  } | null;
  const booker = booking.booker as unknown as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  const addOns = (booking.add_ons ?? []) as unknown as Array<{
    id: string;
    price: number;
    add_on: {
      name: string;
      pricing_mode: "hourly" | "flat";
      unit_price: number;
    } | null;
  }>;
  const payments = ((booking.payments ?? []) as unknown as BookingPaymentRow[])
    .slice()
    .sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    );

  const resourceLineTotal = resource.hourly_rate * booking.duration_hours;
  const remaining = booking.total_price - booking.paid_amount;

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const tz = location?.timezone ?? "America/Santiago";
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-US" : "es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });

  // Inferred timeline events from existing data (5e). Status-change events
  // are intentionally omitted — see design spec 5e for rationale.
  type TimelineEvent = { label: string; at: string };
  const timeline: TimelineEvent[] = [];
  timeline.push({
    label: list.detail.activityCreated,
    at: booking.created_at,
  });
  for (const p of payments) {
    const label =
      p.entry_type === "refund"
        ? list.detail.activityRefund.replace("{amount}", formatCLP(p.amount))
        : list.detail.activityPayment.replace("{amount}", formatCLP(p.amount));
    timeline.push({ label, at: p.paid_at });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-4">
        <Link
          href={`/dashboard/${tenantSlug}/bookings`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          {detail.back}
        </Link>
      </div>

      {/* 5d. Header — strong status hierarchy */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-mono tabular-nums">
            #{booking.booking_number}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateTime(booking.start_time)} · {resource.name}
            {location ? ` · ${location.name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant={STATUS_VARIANT[booking.status] ?? "outline"}
            className="text-sm px-3 py-1"
          >
            {statusLabels[booking.status] ?? booking.status}
          </Badge>
          <PaymentStatusBadge
            status={booking.payment_status}
            label={paymentLabels[booking.payment_status] ?? booking.payment_status}
          />
        </div>
      </div>

      {/* 5b. Quick action rail */}
      <BookingQuickActions
        tenantSlug={tenantSlug}
        bookingId={booking.id}
        status={booking.status}
        startTime={booking.start_time}
      />

      {/* 5a. Two-column grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main column (col-span-2) */}
        <div className="md:col-span-2 space-y-6">
          {/* 5f. Lines and payments consolidated */}
          <Card>
            <CardContent className="pt-6 text-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.linesAndPayments}
              </h2>
              <div className="flex justify-between py-1">
                <div>
                  <div>{detail.resourceLine}: {resource.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {booking.duration_hours}h × {formatCLP(resource.hourly_rate)}
                  </div>
                </div>
                <div className="font-medium tabular-nums">
                  {formatCLP(resourceLineTotal)}
                </div>
              </div>
              {addOns.map((item) => {
                const mode = item.add_on?.pricing_mode;
                const unit = item.add_on?.unit_price;
                const breakdown =
                  mode === "hourly" && unit != null
                    ? `${formatCLP(unit)}/h × ${booking.duration_hours}h`
                    : mode === "flat"
                      ? detail.flatFee
                      : null;
                return (
                  <div key={item.id} className="flex justify-between py-1">
                    <div>
                      <div>{item.add_on?.name ?? "—"}</div>
                      {breakdown && (
                        <div className="text-xs text-muted-foreground">
                          {breakdown}
                        </div>
                      )}
                    </div>
                    <span className="tabular-nums">
                      {formatCLP(item.price)}
                    </span>
                  </div>
                );
              })}
              <Separator className="my-3" />
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">
                  {list.detail.subtotal}
                </span>
                <span className="tabular-nums">
                  {formatCLP(booking.total_price)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">
                  {list.detail.paid}
                </span>
                <span className="tabular-nums">
                  {formatCLP(booking.paid_amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-base font-semibold">
                <span>{list.detail.remaining}</span>
                <span className="tabular-nums">{formatCLP(remaining)}</span>
              </div>
              <Separator className="my-3" />
              <BookingPaymentPanel
                tenantSlug={tenantSlug}
                bookingId={booking.id}
                totalPrice={booking.total_price}
                paidAmount={booking.paid_amount}
                paymentStatus={booking.payment_status}
                payments={payments}
                locale={locale}
                timeZone={tz}
              />
            </CardContent>
          </Card>

          {/* 5e. Activity timeline (inferred) */}
          <Card>
            <CardContent className="pt-6 text-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.activityTitle}
              </h2>
              <ul className="space-y-2">
                {timeline.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <div>{e.label}</div>
                      <div
                        className="text-xs text-muted-foreground"
                        title={new Date(e.at).toISOString()}
                      >
                        {formatDateTime(e.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 5c. Sidebar — compact customer + location block */}
        <aside className="space-y-6 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {list.detail.sectionCustomer}
            </h2>
            <div className="font-medium">{booker.name}</div>
            <div className="text-muted-foreground">{booker.email}</div>
            {booker.phone && (
              <div className="text-muted-foreground">{booker.phone}</div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {list.detail.sectionLocation}
            </h2>
            <div>{location?.name ?? "—"}</div>
            {location?.address && (
              <div className="text-muted-foreground">{location.address}</div>
            )}
          </section>
          {booking.notes && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.sectionNotes}
              </h2>
              <div className="whitespace-pre-wrap">{booking.notes}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Open any booking's detail page. Expected: new layout appears — bigger `#number`, pills at top-right, quick action rail below header, two-column grid with consolidated line items + payments on the left and compact customer/location sidebar on the right, inferred timeline below the payments.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/[tenantSlug]/bookings/[bookingId]/page.tsx"
git commit -m "Refactor booking detail page with 5 targeted fixes"
```

---

## Task 22: Playwright E2E — `tests/app/dashboard/bookings-page.spec.ts`

**Files:**
- Create: `tests/app/dashboard/bookings-page.spec.ts`

**Prerequisite:** Run `npm run db:reset` so the faker seed has the data the tests expect.

- [ ] **Step 1: Look at an existing dashboard e2e test for the login / setup pattern**

```bash
cat tests/app/dashboard.spec.ts
```

Note the auth setup pattern (likely uses `tests/global.setup.ts` to log in once and persist storage state).

- [ ] **Step 2: Create the spec**

Create `/Users/benjaminjacksoncevasco/bukarrum-v0/tests/app/dashboard/bookings-page.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// These tests run against the seed produced by `npm run db:reset`. They
// assume at least one tenant exists and has a mix of pending, confirmed,
// unpaid, and archived bookings. Use the first tenant slug discovered
// on the dashboard sidebar.

test.describe("Bookings admin page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    // Navigate to the first tenant's bookings page via the sidebar link.
    await page.getByRole("link", { name: /reservas/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/[^/]+\/bookings/);
  });

  test("renders header, omnibox, tabs, filter bar and table", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /reservas/i, level: 1 })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por número/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /pendientes/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /fecha/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("switching to 'Pendientes' tab updates URL and narrows rows", async ({
    page,
  }) => {
    const before = await page.locator("tbody tr").count();
    await page.getByRole("link", { name: /pendientes/i }).click();
    await expect(page).toHaveURL(/tab=pending/);
    const after = await page.locator("tbody tr").count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test("omnibox search updates URL with debounce", async ({ page }) => {
    await page.getByPlaceholder(/buscar por número/i).fill("1");
    // Wait past the debounce window
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/q=1/);
  });

  test("clicking a row navigates to the detail page", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    const number = await firstRow.locator("td").nth(1).innerText();
    await firstRow.locator("a").first().click();
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
    await expect(page.locator("h1")).toContainText(number.trim());
  });

  test("empty state renders when filters match nothing", async ({ page }) => {
    await page
      .getByPlaceholder(/buscar por número/i)
      .fill("zzzz-nonexistent-xyz");
    await page.waitForTimeout(400);
    await expect(page.getByText(/no hay reservas que coincidan/i)).toBeVisible();
  });

  test("selecting rows reveals the bulk action bar", async ({ page }) => {
    // Go to the 'Pendientes' queue so we have rows with valid 'Confirmar' state.
    await page.getByRole("link", { name: /pendientes/i }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    test.skip(count === 0, "No pending bookings in seed");

    await rows.nth(0).locator('button[role="checkbox"]').click();
    if (count > 1) {
      await rows.nth(1).locator('button[role="checkbox"]').click();
    }
    await expect(page.getByText(/seleccionadas?/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^confirmar$/i })
    ).toBeEnabled();
  });

  test("bulk confirm updates status", async ({ page }) => {
    await page.getByRole("link", { name: /pendientes/i }).click();
    const firstRow = page.locator("tbody tr").first();
    test.skip(!(await firstRow.isVisible()), "No pending bookings in seed");

    await firstRow.locator('button[role="checkbox"]').click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();

    await expect(page.locator('[data-sonner-toast]')).toContainText(
      /confirmada/i
    );
  });

  test("detail page shows quick actions and timeline", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator("a").first().click();
    await expect(page.locator("h1")).toBeVisible();
    // Quick action rail should be present (at least one primary button or the ⋮)
    await expect(page.getByRole("button", { name: /más acciones/i })).toBeVisible();
    // Activity section heading
    await expect(page.getByText(/actividad/i)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npm run db:reset
npm run test:e2e -- dashboard/bookings-page.spec.ts
```

Expected: all tests pass. Some may skip based on seed content (test.skip calls handle that gracefully).

- [ ] **Step 4: Commit**

```bash
git add tests/app/dashboard/bookings-page.spec.ts
git commit -m "Add Playwright e2e coverage for bookings admin page"
```

---

## Task 23: Manual QA walkthrough + type-check / lint / migration verification

**No files changed** — this is a checklist pass.

- [ ] **Step 1: Full typecheck + lint + unit tests**

```bash
npm run type-check
npm run lint
npm run test:unit
```

All three must pass cleanly.

- [ ] **Step 2: Full db reset + playwright**

```bash
npm run db:reset
npm run test:e2e
```

All e2e tests must pass.

- [ ] **Step 3: Manual UI walkthrough**

```bash
npm run dev
```

Walk through **each of these paths** and confirm expected behavior. Take a screenshot of each for the PR.

1. Default landing page → "Todas" tab active, all rows, correct total subtitle.
2. Click through each tab (Pendientes, Por cobrar, Próximas 7 días, Vencidas, Archivadas) → rows narrow correctly, counts match.
3. Filter bar: select a location → only its bookings; then select a resource → even narrower; clear filters → back to full list.
4. Filter bar: pick date range in the calendar popover → URL has `from`/`to`, rows narrow.
5. Add-ons chip: click once → "Con extras", click again → "Sin extras", click again → unset.
6. Omnibox: search a known booker name → narrows; clear → restores.
7. Empty state: search something bogus → empty state appears with the search query echoed.
8. Pagination: on a tab with >50 rows, `page=2` works and "Página 2 de N" shows.
9. Bulk confirm: select 2 pending bookings → Confirmar → toast, counts update, rows move to confirmed queue.
10. Bulk cancel: select a confirmed booking → Cancelar → toast, booking archives.
11. Bulk no-show: try from Pendientes — disabled. Try from "Vencidas" (past confirmed) — enabled, action works.
12. Bulk CSV export: select 2 rows → Exportar CSV → file downloads, opens in Excel with Spanish headers and BOM.
13. Detail page: booking number at `text-3xl`, pills at top-right, quick action rail below.
14. Detail page: "Confirmar" quick action flips status.
15. Detail page: activity timeline shows "Reserva creada" plus any payment events in chronological order.
16. Detail page: sidebar shows customer + location without nested cards.
17. Mobile (375px viewport): filter bar becomes "Filtros" button, bulk action bar absent or works, table columns collapse.

- [ ] **Step 4: Sanity-check the migration rollback story**

`git stash` any in-progress work and run:

```bash
npm run db:reset
```

Expected: the full migration applies fresh from an empty DB without error. If this fails, the migration has a forward-compat problem and must be fixed before push.

- [ ] **Step 5: (optional) Profile the main list query on a large seed**

If the seed is small, temporarily grow it with `FAKER_SEED=99 SEED_BOOKINGS_COUNT=5000 npm run db:reset` (if the seed respects such an env var — check `supabase/seed/index.ts` first) and run `explain analyze` via `supabase db psql --local` on the main list query. Verify the new indexes are being hit. Commit any additional indexes if needed (in a new migration — do not edit the existing one).

- [ ] **Step 6: No commit** — this task is verification only.

---

## Task 24: Push branch (stop)

**Per the Git Workflow in [CLAUDE.md](../../../CLAUDE.md#git-workflow), stop at push. PR creation and merge are explicit follow-up steps.**

- [ ] **Step 1: Confirm branch is clean and all commits are local**

```bash
git status
git log --oneline origin/main..HEAD
```

Expected: clean working tree. Commit log shows all tasks (approximately 22 commits from Tasks 1-22).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feature/bookings-admin-redesign
```

Expected: branch pushed, upstream set.

- [ ] **Step 3: Report to the user**

Share the branch name and a summary of what's in it. Do **not** open a PR or merge without explicit instruction.

---

## Summary

| Task | Category | Touches |
|---|---|---|
| 1 | Test infra | `package.json`, `vitest.config.ts`, smoke test |
| 2 | Database | Migration SQL |
| 3 | Types | Regenerated `database.types.ts` |
| 4 | `_lib/types.ts` | Shared types |
| 5 | `_lib/filters.ts` | `parseSearchParams` (TDD) |
| 6 | `_lib/queries.ts` | `buildBookingsQuery`, `buildCountsQuery`, `resolveCounts` (TDD) |
| 7 | `_lib/csv.ts` | `bookingsToCsv` (TDD) |
| 8 | i18n | `es.json`, `en.json` |
| 9 | Component primitives | `sonner`, `checkbox`, Toaster in layout |
| 10 | Server Actions | Bulk confirm/cancel/no-show |
| 11 | API route | CSV export route handler |
| 12 | Scaffold | Header + empty state wired into existing page |
| 13 | Client island | Omnibox |
| 14 | Client island | Tab strip |
| 15 | Client island | Filter bar |
| 16 | Table | Row + table + selection context stub |
| 17 | Client island | Pagination |
| 18 | Client island | Bulk action bar + selection context extension |
| 19 | Integration | Full `page.tsx` rewrite |
| 20 | Detail page | Quick action rail |
| 21 | Detail page | Full rewrite for 5 targeted fixes |
| 22 | Tests | Playwright E2E |
| 23 | QA | Manual walkthrough |
| 24 | Ship | Push branch |
