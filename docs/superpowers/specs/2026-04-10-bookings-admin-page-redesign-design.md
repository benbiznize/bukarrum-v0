# Bookings Admin Page Redesign — Design Spec

**Date:** 2026-04-10
**Scope:** `/dashboard/[tenantSlug]/bookings` (list page, full redesign) + `/dashboard/[tenantSlug]/bookings/[bookingId]` (detail page, 5 targeted fixes)
**Inspired by:** Shopify Admin Orders
**Out of scope:** Dashboard home redesign ("today & tomorrow" glance view — separate spec), `booking_events` history table, customer-profile page

---

## Goal

Turn the admin bookings page into a proper Shopify-style workhorse for Chilean studio owners: a triage queue first, a customer-lookup tool second, and a historical ledger third. Adapt Shopify's orders-page patterns (tabs, filter bar, omnibox, bulk actions, two-pill status system) to the bookings domain without copying slavishly.

The page today is a flat table sorted by `start_time desc`. It has the right data (two-pill status pattern is already in place) but none of the structure that makes Shopify's orders page a triage tool: no queues, no filters, no search, no bulk actions, no pagination.

The detail page today is serviceable but sparse — stacked cards, weak status hierarchy, no timeline, actions buried in a dropdown. We fix five specific pain points without a full rewrite.

---

## Primary jobs (ranked)

1. **Triage queue** — the studio owner opens the page to react to incoming work: confirm pending bookings, chase unpaid ones, handle past-due confirmations. This is the #1 daily use and the page's primary job.
2. **Customer lookup** — a customer calls or WhatsApps ("I booked for Saturday"). The owner needs to find the booking in one search.
3. **Historical review** — accounting, revisiting what happened, exporting data.

Operational awareness ("who's coming in today") is deliberately **not** a bookings-page job. That becomes a dashboard home widget in a separate spec.

---

## Architecture approach

**URL-as-source-of-truth, Server Component core, small client islands, optimistic updates only on bulk actions.**

- Server Components do the data work: parse `searchParams`, run Supabase queries, render the page.
- Client Components only where URL state is wrong or insufficient: omnibox (keeps focus across renders), filter dropdown open state, selection checkboxes, pagination, bulk action bar.
- Filter / tab / pagination state lives in the URL query string. Back button, shareable URLs, and page reloads all preserve state automatically.
- Selection state and dropdown-open state are ephemeral client state.
- Bulk actions use React 19 `useOptimistic` so the UI flips immediately on click, with server revalidation catching up.

This matches the existing codebase patterns (server-first, no TanStack dependencies) and leverages Next.js 16 App Router features already in use across the dashboard.

---

## File structure

All new files live under `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/`:

```
bookings/
├── page.tsx                             # Server Component — auth, parses searchParams, orchestrates
├── actions.ts                           # (existing) + 4 new bulk-action Server Actions
├── _lib/
│   ├── filters.ts                       # parseSearchParams() → typed BookingsFilters object
│   ├── queries.ts                       # buildBookingsQuery() + buildCountsQuery()
│   └── types.ts                         # BookingsFilters, BookingsTab, BookingRow, CountsByTab
└── _components/
    ├── bookings-header.tsx              # Server — title + omnibox slot + total count subtitle
    ├── bookings-omnibox.tsx             # Client — search input, debounced 250ms
    ├── bookings-tabs.tsx                # Client — tab strip with live count badges
    ├── bookings-filter-bar.tsx          # Client — date/location/resource/has-add-ons chips
    ├── bookings-table.tsx               # Server — renders rows
    ├── bookings-row.tsx                 # Server — two-line row with stacked status pills
    ├── bookings-empty-state.tsx         # Server — per-tab empty states
    ├── bookings-pagination.tsx          # Client — prev/next + page N of M
    └── bookings-bulk-action-bar.tsx     # Client — sticky action bar, useOptimistic wrapper
```

**Rationale:**

- **Colocation in the route folder** (underscore-prefixed) keeps page-specific logic with the route and out of Next.js routing. The three `_lib/` functions (`parseSearchParams`, `buildBookingsQuery`, `buildCountsQuery`) are the only code worth unit-testing — everything else is presentation or DB round-trips.
- **One file per concern.** The current `page.tsx` is 230 lines and already hitting the limit of comfortable reading. Adding tabs + filter bar + omnibox + bulk actions would push it well past 2000 lines if inlined. Splitting along Shopify-style seams (header, tabs, filter bar, table, bulk action bar, pagination) matches how the UI is actually composed.
- **Shared components that already exist stay put:** [booking-status-actions.tsx](../../../src/components/dashboard/booking-status-actions.tsx), [payment-status-badge.tsx](../../../src/components/dashboard/payment-status-badge.tsx), [booking-payment-panel.tsx](../../../src/components/dashboard/booking-payment-panel.tsx). The new page imports them; no rewrites of the status-transition or payment-add machinery.

**Detail page** stays as a single file (~400-450 lines after changes) at [bookings/[bookingId]/page.tsx](../../../src/app/(dashboard)/dashboard/[tenantSlug]/bookings/[bookingId]/page.tsx). Decomposition payoff isn't there for the detail page — complexity is moderate, most of the content is presentation, and keeping it in one file is easier to reason about.

---

## URL schema

Everything except selection and dropdown-open state lives in the URL.

```
/dashboard/[tenantSlug]/bookings?
  tab=pending              // 'pending' | 'unpaid' | 'upcoming' | 'past_due' | 'all' | 'archived' — default 'all'
  &q=juan                  // omnibox query — searches booking_number, booker.name, booker.email, booker.phone
  &location=<locId>        // single location UUID
  &resource=<resId>        // single resource UUID
  &from=2026-04-01         // ISO date; start_time >= from at 00:00 Chile time
  &to=2026-04-30           // ISO date; start_time <= to at 23:59:59 Chile time
  &has_add_ons=1           // '1' | '0' | absent
  &page=2                  // 1-indexed, default 1
```

### Design rules

- **Missing param = unfiltered.** No implicit "last 30 days" or other hidden filters.
- **Default tab is `all`.** Landing on `/bookings` shows every booking.
- **Dates interpreted in `America/Santiago`** for MVP. Multi-location tenants spanning timezones are a future concern; document the simplification.
- **Binary `has_add_ons` toggle** with three chip states: "with", "without", off (unset).
- **Invalid params fall back to defaults.** Unknown `tab` → `all`. Malformed dates → dropped. No 500s.
- **Changing tab or any filter resets `page` to 1.**
- **Selection state is NOT in the URL** (ephemeral React context).
- **Page size is fixed at 50.** Not user-configurable.

### Query builder composition (pseudocode)

```ts
function buildBookingsQuery(supabase, tenantId, filters) {
  let q = supabase.from('bookings')
    .select(ROW_SELECT, { count: 'exact' })
    .eq('resource.tenant_id', tenantId);

  switch (filters.tab) {
    case 'pending':
      q = q.eq('status', 'pending');
      break;
    case 'unpaid':
      q = q.eq('status', 'confirmed')
           .in('payment_status', ['unpaid', 'partial']);
      break;
    case 'upcoming':
      q = q.eq('status', 'confirmed')
           .gte('start_time', now.toISOString())
           .lte('start_time', addDays(now, 7).toISOString());
      break;
    case 'past_due':
      q = q.eq('status', 'confirmed')
           .lt('start_time', now.toISOString());
      break;
    case 'archived':
      q = q.in('status', ['completed', 'cancelled', 'no_show']);
      break;
    case 'all':
      /* no status filter */
      break;
  }

  if (filters.location)   q = q.eq('location_id', filters.location);
  if (filters.resource)   q = q.eq('resource_id', filters.resource);
  if (filters.from)       q = q.gte('start_time', localDateToUtc(filters.from, 'start'));
  if (filters.to)         q = q.lte('start_time', localDateToUtc(filters.to, 'end'));
  if (filters.hasAddOns === true)  q = q.eq('has_add_ons', true);
  if (filters.hasAddOns === false) q = q.eq('has_add_ons', false);
  if (filters.q)          q = supabase.rpc('search_bookings', { tenant_id: tenantId, query: filters.q, ...otherFilters });

  q = q.order('start_time', { ascending: false })
       .range((filters.page - 1) * 50, filters.page * 50 - 1);

  return q;
}
```

The `has_add_ons` filter uses a materialized boolean column (see Database section). The omnibox `q` uses a Postgres RPC because filtering on joined relations is painful in Supabase's query builder.

### Counts query

Six parallel `count('exact', { head: true })` queries, one per tab, each respecting the non-tab filters (location, resource, from, to, has_add_ons, q). Runs in `Promise.all` — total latency is the slowest single count, not the sum. Counts failing individually render as `(—)` without breaking the page.

---

## Top chrome: header, omnibox, tab strip, filter bar

### Header

- `<h1>Reservas</h1>` (existing i18n key) with a muted subtitle: `"12 de 148 reservas"` / `"12 of 148 bookings"` showing current-filter count vs total-in-tenant count.
- **No "New booking" CTA.** Bookings come in through the public flow, not out of the admin. Adding a button here would be misleading.

### Omnibox

- Directly below the header, full-width, prominent `<Input>` with a search icon and placeholder: *"Buscar por número, cliente, email o teléfono…"*.
- **Live search**, debounced 250ms. `router.replace()` (not `push`) to keep keystrokes out of back-button history.
- **Loading hint** via `useTransition` — small spinner appears while the Server Component re-renders.
- **Empty-search result** routes to a search-specific variant of `bookings-empty-state.tsx` ("No bookings match '<q>'").
- **No keyboard shortcut** in MVP.

### Tab strip

Six queues as horizontal links directly below the omnibox. i18n labels:

| Tab key | URL value | Spanish | English |
|---|---|---|---|
| All | `all` | Todas | All |
| Pending | `pending` | Pendientes | Pending |
| Needs payment | `unpaid` | Por cobrar | Needs payment |
| Next 7 days | `upcoming` | Próximas 7 días | Next 7 days |
| Past due | `past_due` | Vencidas | Past due |
| Archived | `archived` | Archivadas | Archived |

**Rules:**

- **Counts always shown**, even when zero.
- **Counts respect non-tab filters.** Filter by location → every tab's count updates.
- **Active state derived from `searchParams.tab`**, not client state. Plain `<Link>` components.
- **Changing tab resets `page` to 1** and preserves all other filter params.
- **Mobile:** horizontally scrollable (`overflow-x-auto flex-nowrap`), no wrap, no accordion.
- **Active tab styling:** underlined + `text-foreground`. Inactive: `text-muted-foreground`.
- Implementation uses a plain `<nav>` with `<Link>` children — not shadcn/ui `Tabs`, which wants to own its content panel and fights the rest-of-page layout.

### Filter bar

Single horizontal row below the tab strip with four filter chips:

```
[Fecha: Este mes ▾]  [Sede: Todas ▾]  [Recurso: Todos ▾]  [Con extras ✕]  Limpiar filtros
```

Each chip is a shadcn/ui `Popover` containing the control. Chip labels reflect current state so filters are readable at a glance without opening.

- **Fecha (date range):** quick presets ("Hoy", "Ayer", "Esta semana", "Este mes", "Últimos 30 días", "Personalizado"). Custom opens a small calendar range picker using components from [src/components/dashboard/calendar/](../../../src/components/dashboard/calendar/). Chip label shows selected range summary.
- **Sede (location):** single-select, lists tenant locations + "Todas".
- **Recurso (resource):** single-select, lists tenant resources + "Todos". **Scoped** to the selected location when one is active.
- **Con extras:** three-state toggle — "Con extras" / "Sin extras" / off. Click cycles forward. When active, the chip has a colored border + `×` to clear.
- **Limpiar filtros:** plain text button, removes every filter param including `q` and `tab`. Only shown when at least one filter is active.

**Rules:**

- **Apply-on-select.** No "Apply filters" button. Every change pushes a new URL immediately.
- **Mobile:** below `md:`, the filter bar collapses to a single "Filtros" button that opens a Sheet with all filters stacked.

### Visual rhythm

Comfortable, not compact — `px-6 py-4` on the page, `gap-4` between chips, `gap-6` between header/omnibox/tabs. Workhorse page where readability beats density.

```
┌─────────────────────────────────────────────┐
│ Reservas                                    │
│ 12 de 148 reservas                          │
├─────────────────────────────────────────────┤
│ [🔍 Buscar por número, cliente, email…   ] │
├─────────────────────────────────────────────┤
│ Todas Pendientes Por cobrar Próximas ···   │
├─────────────────────────────────────────────┤
│ [Fecha ▾] [Sede ▾] [Recurso ▾] [Extras]   │
├═════════════════════════════════════════════┤
│ ... table starts here ...                   │
```

---

## Table, bulk action bar, pagination

### Row layout — two-line, dense-but-readable

Eight columns (down from ten), row height ~56-64px (two lines):

| # | Column | Line 1 | Line 2 (muted) |
|---|---|---|---|
| 1 | Selection | `<Checkbox />` | — |
| 2 | Booking # | `#1042` (font-mono, tabular-nums) — links to detail | — |
| 3 | Cuándo | `12 abr 2026 · 14:00` | `Estudio A · Santiago` |
| 4 | Cliente | `Juan Pérez` (font-medium) | `juan@mail.cl` |
| 5 | Duración | `3h` (centered, tabular-nums) | — |
| 6 | Total | `$45.000 CLP` (right-aligned, tabular-nums) | — |
| 7 | Estado | `● Confirmada` (booking status pill) | `● Parcial` (payment status pill) |
| 8 | Row menu | `⋮` opens `DropdownMenu` with single-row actions | — |

**The "Cuándo" column** stacks date+time on line 1 and resource+location on line 2. Saves two full columns vs the current layout. Trade-off accepted: you lose the ability to sort independently by room, but sorting by start_time is the universal default anyway.

**Stacked status pills** (booking + payment, vertical) keep the Estado column narrow. Both labels are short; the vertical stack reinforces "these are orthogonal axes".

### Row interactions

- **Full-row click** navigates to the detail page. Implemented with a `<Link>` wrapping the row contents; inner interactive elements (checkbox, status pills, `⋮` menu) use `stopPropagation()`. Flagged as a known Next/Radix integration gotcha in the implementation plan.
- **Hover state:** `bg-muted/40`. Cursor `pointer` only where clickable.

### Mobile layout

Below `md:`, hide columns 1, 5, 6, 8. Collapse the row into a Card-style block: booking number + date, customer, status pills, total. Tap anywhere to open detail. **No bulk actions on mobile** — this is desk work.

### Bulk action bar

Appears inline **above the table, replacing the filter bar**, only when at least one row is selected. Sticky to the top of the table on scroll.

```
┌─────────────────────────────────────────────────────┐
│ 3 seleccionadas   [Confirmar] [Cancelar] [No-show] [Exportar CSV]   [Deseleccionar] │
└─────────────────────────────────────────────────────┘
```

**Button enablement:**

- **Confirmar** — enabled only when all selected rows have `status='pending'`. Disabled otherwise, tooltip explains.
- **Cancelar** — enabled when no selected row is already in `cancelled`, `completed`, or `no_show`.
- **No-show** — enabled only when all selected rows are past `confirmed` bookings (`start_time < now`).
- **Exportar CSV** — always enabled when selection non-empty.
- **Deseleccionar** — clears selection (client state reset).

**Optimistic flow (the only place we use `useOptimistic`):**

1. User clicks "Confirmar" with 3 rows selected.
2. Client wraps selected IDs in a `useOptimistic` transition — the rows' status pills flip to "Confirmada" immediately.
3. `confirmBookings(ids)` Server Action runs: re-authorizes tenant ownership, updates status, returns `{ success, affectedCount }`.
4. `revalidatePath()` refreshes the Server Component; fresh data replaces optimistic state.
5. On success: `toast.success("3 reservas confirmadas")`. On error: rows revert, `toast.error()` explains.

**CSV export** is not optimistic — it's a Server Action that returns a streamed CSV `Response` via a hidden form POST or a route handler at `app/api/bookings/export/route.ts`. Exports the **selected rows only**, not the full filtered set (matches the bulk-action metaphor). A whole-filter-set export can be added as a separate page-level action later.

**Animation:** slides in from the top via `data-state` + Tailwind transitions. Shopify pattern.

### Pagination

Below the table, right-aligned:

```
                                          Página 2 de 5   [‹ Anterior] [Siguiente ›]
```

- Plain `<Link>` components, no client state.
- **Disabled at bounds.**
- **Hidden entirely** when total is 0 or single-page.
- **No "jump to page N" input, no numbered buttons.** Medium scale doesn't need it.
- **No auto-scroll to top** on page change — Next.js preserves scroll position naturally, which is the right behavior here.

---

## Detail page — 5 targeted fixes

Single file, no decomposition. Expected size after changes: ~400-450 lines.

### 5a. New layout — two-column with sidebar

Replace the current `grid md:grid-cols-2` (two info cards stacked) with a proper **two-column layout**:

```
┌─────────────────────────────────────────────────────────┐
│ ← Reservas                                              │
│                                                         │
│ #1042                       [● Confirmada] [● Parcial]  │  ← Header (5d)
│ 12 abr 2026 · 14:00 · Estudio A Santiago                │
│                                                         │
│ [Confirmar] [+ Pago] [Cancelar] [Marcar no-show] [⋮]    │  ← Quick actions (5b)
│                                                         │
├──── Main (col-span-2) ──────┬──── Sidebar (col-span-1) ─┤
│ Detalles                    │ Cliente                   │  ← Sidebar (5c)
│ Fecha  12 abr 14:00 · 3h    │ Juan Pérez                │
│ Recurso  Estudio A          │ juan@mail.cl              │
│ Ubicación  Estudio Santiago │ +56 9 1234 5678           │
│                             │                           │
│ Líneas y pagos  (5f)        │ Ubicación                 │
│   Estudio A · 3h × $15k     │ Estudio A                 │
│   Add-on · Flat             │ Av. Providencia 123       │
│   ────────                  │ Santiago                  │
│   Subtotal        $45.000   │                           │
│   Pagado          $20.000   │ (notas si existen)        │
│   Restante        $25.000   │                           │
│                             │                           │
│   Pagos                     │                           │
│   ● 3 abr 16:40 · $20.000   │                           │
│   [+ Agregar pago]          │                           │
│                             │                           │
│ Actividad  (5e)             │                           │
│ ● Creada  2 abr 14:22       │                           │
│ ● Pago $20.000  3 abr 16:40 │                           │
└─────────────────────────────┴───────────────────────────┘
```

CSS: `grid md:grid-cols-3 gap-6`, main is `md:col-span-2`, sidebar is `md:col-span-1`. Below `md:` the sidebar drops below the main column.

### 5b. Quick-action rail (fixes "hidden actions")

Horizontal button group directly below the header, above the two-column grid. **Context-aware** — buttons shown depend on current `status`:

- **Pending:** `[Confirmar]` (primary) · `[Cancelar]` (outline-destructive) · `[⋮]`
- **Confirmed future:** `[+ Pago]` (primary) · `[Cancelar]` (outline-destructive) · `[⋮]`
- **Confirmed past (not yet completed):** `[Marcar como completada]` (primary) · `[Marcar no-show]` · `[+ Pago]` · `[⋮]`
- **Completed:** `[+ Pago]` · `[Reembolsar]` · `[⋮]`
- **Cancelled / no-show:** `[⋮]` only (with "Reactivar" to send back to pending)

The `[⋮]` dropdown always contains: "Copiar enlace", "Imprimir", and any edge-case actions not in the primary rail.

**New component:** `src/components/dashboard/booking-quick-actions.tsx`. Reuses the same Server Actions as the existing [booking-status-actions.tsx](../../../src/components/dashboard/booking-status-actions.tsx) (which stays in place as the list-page row dropdown). No rewrite of state-transition logic.

**Loading state:** same `useOptimistic` pattern as the list-page bulk actions. Click → header pill flips immediately → Server Action runs → revalidate catches up → toast on success, revert on error.

### 5c. Sidebar — compact customer + location block (fixes "wasted space")

Replace the two-card grid with a **single vertical stack of label-value sections**, no nested Card chrome. Each section has a subdued heading (`text-xs font-semibold uppercase text-muted-foreground`) and tight facts below.

Sections:

1. **Cliente** — name (bold), email, phone. If the booker has other bookings in this tenant, a small link *"Ver 3 más"* that navigates to `/bookings?q=<email>` (list page filtered by the booker — placeholder for future customer-profile page).
2. **Ubicación** — location name, address if present. No map embed.
3. **Notas** — if `booking.notes` exists. Plain text, `whitespace-pre-wrap`.

Net effect: ~50% less vertical space than the current two-card grid, reads like a Shopify order sidebar.

### 5d. Header block with strong status hierarchy (fixes "weak status hierarchy")

```
← Reservas                                                   (link, text-xs)
                                                             (py-4 gap)
#1042                              [● Confirmada] [● Parcial]
    (text-3xl font-bold font-mono tabular-nums)    (size='lg' pills)

12 abr 2026 · 14:00 · Estudio A · Santiago
    (text-sm text-muted-foreground, single line breadcrumb)
```

- **Booking number `text-3xl`** (up from `text-2xl`).
- **Status pills `size='lg'`** (up from default `size='sm'`), prominent at top-right.
- **Datetime + resource + location** as a single breadcrumb-style muted line below the number.
- **No "Reserva" subtitle caption.** The `<h1>` is enough.

### 5e. Inferred activity timeline (fixes "no timeline")

**MVP compromise:** do not add a `booking_events` table. Instead, build the timeline from data we already have — **only events we can source reliably**:

| Event | Source |
|---|---|
| *Reserva creada* | `bookings.created_at` + `booker.name` |
| *Pago de $X registrado* | rows in `booking_payments` with `entry_type='payment'` |
| *Reembolso de $X* | rows in `booking_payments` with `entry_type='refund'` |

**Status change events (confirmed, completed, cancelled, no-show) are omitted** from the timeline in this spec — we don't have history, and using `updated_at` as a proxy would be misleading ("Confirmed Apr 3" when that might actually be a later cancel). Honest labels beat guesses.

**Follow-up spec** (not in this scope): create `booking_events` table with triggers on `bookings` status updates. When that lands, revisit this section to read from the events table and include the full status history.

**Visual:** vertical list, one event per line, muted dot + label + relative time ("hace 2 días") with tooltip showing absolute time. Custom ~30-line component inline in the detail page file.

### 5f. Line items + payments consolidated (fixes "payment detached from total")

**Currently:** "Line items" Card → separator → Total row. Then a separate "Payments" Card below.

**New:** single **"Líneas y pagos"** block (no Card chrome nesting, or one Card containing both) with:

```
Estudio A · 3h × $15k                               $45.000
Add-on: Audio engineer (tarifa fija)                $10.000
────────────────────────────────────────────────────
Subtotal                                            $55.000
Pagado                                              $20.000
Restante                                            $35.000

Pagos
● 3 abr 16:40 · Efectivo · $20.000
[+ Agregar pago]
```

Subtotal / Pagado / Restante reads as a single vertical financial scan. Individual payments appear directly below in the same block. The existing [BookingPaymentPanel](../../../src/components/dashboard/booking-payment-panel.tsx) stays as the interactive component — just relocated inline.

### Explicitly out of scope for the detail page

- Booker's other bookings listing (placeholder link only — future customer-profile spec)
- Email the customer from the detail page
- Notes editor — notes stay read-only
- Print view
- Tags / custom fields — not in the data model
- Map embed for the location
- `booking_events` table and proper status-change history
- Any change to [BookingPaymentPanel](../../../src/components/dashboard/booking-payment-panel.tsx) internals

---

## Database work

One migration: `supabase/migrations/YYYYMMDDHHMMSS_bookings_page_redesign.sql`.

### Indexes

```sql
-- Main list query: tenant-scoped via resource FK, sorted by start_time
create index if not exists bookings_resource_start_idx
  on public.bookings (resource_id, start_time desc);

create index if not exists bookings_location_start_idx
  on public.bookings (location_id, start_time desc);

-- Count queries by status (partial — ~80% of rows land in 'completed')
create index if not exists bookings_status_pending_confirmed_idx
  on public.bookings (status) where status in ('pending', 'confirmed');

-- Composite for the 'unpaid' queue
create index if not exists bookings_status_payment_idx
  on public.bookings (status, payment_status);
```

Profile with `explain analyze` in the implementation plan before committing — the shape may shift based on what Supabase's automatic FK indexes already cover.

### Materialized `has_add_ons` column

Filtering "bookings with add-ons" via a subquery on the joined `booking_add_ons` relation is painful in Supabase's query builder. Solution: a materialized boolean column on `bookings`, kept in sync by a trigger.

```sql
alter table public.bookings add column has_add_ons boolean not null default false;

-- Backfill existing rows
update public.bookings b
set has_add_ons = exists (select 1 from public.booking_add_ons where booking_id = b.id);

-- Trigger: flip to true on insert into booking_add_ons, re-check on delete
create or replace function public.update_booking_has_add_ons() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.bookings set has_add_ons = true where id = new.booking_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.bookings set has_add_ons = exists (
      select 1 from public.booking_add_ons where booking_id = old.booking_id
    ) where id = old.booking_id;
    return old;
  end if;
end;
$$ language plpgsql;

create trigger booking_add_ons_sync_has_add_ons
  after insert or delete on public.booking_add_ons
  for each row execute function public.update_booking_has_add_ons();

create index if not exists bookings_has_add_ons_idx on public.bookings (has_add_ons);
```

### Omnibox search RPC

Multi-column search across joined tables is awkward in the query builder. Cleaner solution: a Postgres RPC.

```sql
create or replace function public.search_bookings(
  p_tenant_id uuid,
  p_query text,
  p_tab text default 'all',
  p_location_id uuid default null,
  p_resource_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_has_add_ons boolean default null,
  p_page int default 1
) returns setof public.bookings
language sql stable security invoker as $$
  select b.*
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.bookers bk on bk.id = b.booker_id
  where r.tenant_id = p_tenant_id
    and (p_query = '' or
         b.booking_number::text ilike '%' || p_query || '%' or
         bk.name ilike '%' || p_query || '%' or
         bk.email ilike '%' || p_query || '%' or
         coalesce(bk.phone, '') ilike '%' || p_query || '%')
    -- ... remaining filter clauses ...
  order by b.start_time desc
  limit 50 offset (p_page - 1) * 50;
$$;
```

RPC is the interface. At medium scale, `ilike` with leading wildcards is acceptable. If the omnibox gets slow, swap the RPC body for a denormalized `booking_search_text` column with a GIN + `pg_trgm` index — the application code doesn't change.

### Post-migration

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

### Rollout

- No feature flag — internal dashboard, no production tenants yet (MVP).
- Migration is additive: new indexes, new column with backfill, new RPC. All coexist with the current page code.
- Ship migration first in its own PR, verify, then ship the UI — or ship both together if the plan's test plan is tight enough.
- Single `git revert` rolls back the UI if needed.

---

## Data flow walkthroughs

### Scenario 1: user clicks "Pendientes" tab

```
1. <Link href="?tab=pending&location=...&from=...&to=..."> click
   ↓ Next.js App Router navigation (soft)
2. Server Component page.tsx re-renders with new searchParams
   ↓
3. parseSearchParams(searchParams) → BookingsFilters
   ↓
4. Promise.all:
   a. buildBookingsQuery(...) → rows + total count
   b. buildCountsQuery(...) → 6 parallel count queries
   c. loadLocationsAndResources(...) → filter dropdown data (unstable_cache wrapped)
   ↓
5. Render <BookingsHeader>, <BookingsTabs counts={...}>, <BookingsFilterBar locations={...} resources={...}>,
          <BookingsTable rows={...}>, <BookingsPagination total={...}>
   ↓
6. Client hydrates: omnibox, filter chips, pagination become interactive.
```

### Scenario 2: user selects 3 rows and clicks "Confirmar"

```
1. Checkbox clicks → ephemeral selection context in <BookingsBulkActionBar>
2. "Confirmar" click → selection validator: all 3 must be status='pending'
3. useOptimistic transition flips the 3 rows' pills to 'confirmed' immediately
4. Server Action confirmBookings(ids) runs:
   - auth.getUser()
   - look up tenant by slug
   - UPDATE bookings SET status = 'confirmed'
     WHERE id IN (ids)
     AND resource_id IN (SELECT id FROM resources WHERE tenant_id = <authTenant>)  ← critical guard
   - revalidatePath(`/dashboard/${tenantSlug}/bookings`)
   - returns { success: true, affectedCount: 3 }
5. Server re-renders; real state replaces optimistic state
6. toast.success("3 reservas confirmadas")
```

### Scenario 3: user types "juan" in omnibox

```
1. Input onChange → 250ms debounce in the client omnibox component
2. router.replace('?...&q=juan')
3. Server re-renders → buildBookingsQuery sees filters.q → calls supabase.rpc('search_bookings', ...)
4. RPC returns matching rows
5. Table re-renders
```

---

## Server Actions

New Server Actions in [bookings/actions.ts](../../../src/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions.ts):

```ts
export async function confirmBookings(bookingIds: string[]): Promise<ActionResult>
export async function cancelBookings(bookingIds: string[]): Promise<ActionResult>
export async function markBookingsNoShow(bookingIds: string[]): Promise<ActionResult>
export async function exportBookingsCsv(bookingIds: string[]): Promise<Response>
```

Each bulk action follows the same pattern:

1. Authenticate user via Supabase `auth.getUser()`.
2. Look up the tenant from the route's `tenantSlug` param.
3. Run a single UPDATE with **both** `id IN (bookingIds)` AND `resource_id IN (SELECT id FROM resources WHERE tenant_id = <authTenant>)` — the second clause is the critical tenant-isolation guard in case a client sends booking IDs from another tenant.
4. Return `{ success, affectedCount, error? }`.
5. `revalidatePath` for the list page.

`ActionResult` type:

```ts
type ActionResult =
  | { success: true; affectedCount: number }
  | { success: false; error: string };
```

---

## Error handling

- **Invalid URL params:** `_lib/filters.ts` silently drops malformed values and falls back to defaults. No 500s. Bookmarks to `?tab=asdf` load the `all` tab.
- **Database query failure (main list):** Server Component wraps `buildBookingsQuery` in try/catch and renders an `<ErrorState />` card inside the table area, preserving header + tabs + filters. Global [error.tsx](../../../src/app/(dashboard)/error.tsx) is the last resort.
- **Count query failures:** individual failures render as `(—)` in the tab badge; page still works.
- **Bulk action failure:** Server Action returns `{ success: false, error }`. Client `useOptimistic` reverts. `toast.error()` explains. Partial failures (e.g. 4/5 succeeded) use `affectedCount` and a warning toast.
- **Omnibox RPC failure:** empty state with "Error de búsqueda, intenta de nuevo". Page doesn't crash.
- **CSV export failure:** toast error, bulk action bar stays open.

---

## Testing strategy

### Unit tests

Only for the `_lib/` functions — pure logic, high bug risk, easy to test. Location: `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/__tests__/`.

1. **`parseSearchParams.test.ts`**
   - Valid inputs for every field
   - Invalid inputs (unknown tab, malformed dates, negative page)
   - Empty params → defaults
   - Type coercion (string → number for page, string → boolean for has_add_ons)
   - Page bounds

2. **`buildBookingsQuery.test.ts`**
   - Mock Supabase client; assert the expected chain of `.eq/.gte/.lte/.in` calls for each tab + filter combination
   - Verify the tenant-isolation `resource.tenant_id` filter always applied
   - Verify `range()` matches page + page size

### Integration tests

New Playwright E2E file: `tests/dashboard/bookings-page.spec.ts`. Seeded data from `npm run db:reset`.

1. **Happy path:** log in, navigate, assert tabs + counts + table + pagination render.
2. **Tab switching:** click "Pendientes", assert URL updates, rows narrow, counts match.
3. **Filter combinations:** select location → URL updates → rows narrow → tab counts update.
4. **Omnibox search:** type booker email → rows narrow → clear → full list returns.
5. **Bulk confirm:** select 2 pending rows → "Confirmar" → optimistic flip → server catch-up → toast → counts update.
6. **Bulk action disabled state:** select mixed selection → "Confirmar" disabled with tooltip.
7. **Detail page quick action:** pending booking → "Confirmar" → header pill flips → timeline shows creation event.
8. **Empty state:** filter with no results → empty state renders.
9. **Mobile:** set viewport 375px → filter bar collapses to Sheet → table columns collapse.

### Manual UI walkthrough

Per the Git Workflow section of [CLAUDE.md](../../../CLAUDE.md): before merge, run `npm run db:reset`, walk through every tab, every filter combo, every bulk action, the detail page refresh, and the mobile layout. Capture screenshots for the PR description.

---

## Open implementation notes

These aren't unresolved design questions — they're things the implementation plan should surface and handle:

1. **Full-row click vs inner interactive elements** — the `<Link>` + `stopPropagation` integration with Radix/shadcn primitives needs attention. Document as a known gotcha.
2. **`has_add_ons` trigger correctness** — test insert, delete, and mixed cases to confirm the trigger never leaves the column out of sync.
3. **RPC parameter shape for `search_bookings`** — decide whether the RPC accepts all filter params (including `tab`, `location`, `from`, `to`) or whether the Server Component first narrows via the normal query builder and then filters text match via a secondary RPC. Prefer all-in-one RPC for one round-trip.
4. **Count query tenant scoping** — counts must all filter by `resource.tenant_id` the same way the main query does, otherwise numbers leak across tenants. This is the single most important correctness concern of the spec.
5. **Tenant local time for `from`/`to`** — pinning to `America/Santiago` means multi-timezone tenants will see slight off-by-hours. Document in code comment near `localDateToUtc` with a TODO for future per-tenant primary timezone.
6. **CSV export format** — column headers in Spanish, UTF-8 BOM for Excel compatibility, all timestamps in the booking's location timezone (not UTC).
7. **i18n key additions** — the plan must enumerate new dictionary keys for tab labels, filter chip labels, empty states, bulk action buttons, tooltips, and timeline event labels. Both `es` and `en` dictionaries must be updated.
8. **Accessibility** — tab strip must be a proper `<nav>` with `aria-current="page"` on the active tab, filter chips must be `<button>` elements with `aria-expanded`, bulk action bar must announce selection count via `aria-live`, row checkboxes must have `aria-label` referencing the booking number.

---

## Summary

| Area | What | Why |
|---|---|---|
| **List page structure** | 10 files under `bookings/` (page + _lib + _components) | Splits along Shopify-style seams; keeps each file focused |
| **URL schema** | `tab + q + location + resource + from + to + has_add_ons + page` | Source of truth; shareable, back-button-friendly, no client state drift |
| **Tabs** | 6 queues with live count badges respecting filters | Primary triage affordance |
| **Omnibox** | Prominent, always visible, searches 4 fields via RPC | Customer-lookup job needs single-keystroke access |
| **Filter bar** | 4 chips with apply-on-select, Sheet on mobile | Narrows within a queue without modes |
| **Table rows** | 8 columns, two-line layout, stacked status pills | Dense but readable, full-row click to detail |
| **Bulk actions** | Confirm / Cancel / No-show / Export CSV with `useOptimistic` | The one place instant feedback matters |
| **Pagination** | Simple prev/next + page N of M, 50/page fixed | Medium scale; no virtual scrolling |
| **Detail page** | 5 targeted fixes: two-column layout, quick actions rail, compact sidebar, stronger header, honest timeline, consolidated line items + payments | Fix the real pains, not every pain |
| **Database** | Indexes, `has_add_ons` column + trigger, `search_bookings` RPC | Server-side filter + pagination needs real indexes; RPC keeps app code clean |
| **Testing** | Unit tests for `_lib/`; Playwright E2E for 9 scenarios | High-value, low-maintenance test surface |
