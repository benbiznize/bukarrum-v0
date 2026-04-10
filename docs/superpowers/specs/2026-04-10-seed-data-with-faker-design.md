# Seed Data Generator — Design

**Date:** 2026-04-10
**Status:** Approved for planning
**Owner:** Benjamin Jackson

## Problem

The current local-dev seed at [supabase/seed.sql](../../../supabase/seed.sql) is 190 lines of hand-written SQL that creates one specific demo scenario (Estudio Sónico, 2 locations, 5 resources, 2 bookings). It doesn't scale:

- **Volume** — 2 bookings isn't enough to exercise the calendar, analytics, or "Top customers" surfaces.
- **Variety** — All data is hardcoded. Resetting produces the exact same sparse scenario, so bugs that only surface under realistic load stay hidden.
- **Maintainability** — Raw SQL with no type safety. Every schema change risks silent seed drift.

Snaplet was considered but rejected: Snaplet Cloud shut down in October 2024, and the remaining open-source library is overkill for our needs (schema inference we don't need, no cloud snapshot workflow).

## Goals

1. `npm run db:reset` produces a rich, realistic-looking multi-tenant dataset ready for hands-on testing.
2. A **stable demo login** (`demo@bukarrum.test` / `demo-password-123` at `/dashboard/estudio-sonico`) survives every reset — same auth user ID, same tenant ID, same location and resource IDs.
3. Enough volume and variety that dashboard, calendar, analytics, and payment-flow bugs surface in dev.
4. Fast enough (<5s) that `db:reset` remains a zero-friction operation.

## Non-goals

- Seeding staging or production. Script refuses to run against anything non-localhost.
- Incremental / additive seeding. Full reset is the only supported flow.
- Schema inference or type-level safety of the Snaplet variety. Raw inserts are fine.
- Unit tests for the seed generators. Pay the cost only if a bug appears.
- CLI flags for tweaking volume / window / variety. Edit constants and re-run.

## Approach

### Stack

| Tool | Purpose |
|---|---|
| `@faker-js/faker` (locale `es`) | Generate Spanish names, emails, phones, company names, notes |
| `tsx` | One-shot TypeScript runner (no build step) |
| `postgres` (npm package) | Raw, fast, transactional DB access |
| `@supabase/supabase-js` (service role) | Create `auth.users` entries via the admin API |
| Node 20 `--env-file` | Load `.env.local` without additional dependencies |

Rationale for `postgres` over `@supabase/supabase-js` for most inserts: the JS client routes through PostgREST and serializes every row individually, which is much slower than raw pg-wire inserts inside a transaction. Only the auth admin API requires `@supabase/supabase-js`.

### Execution flow

```
npm run db:reset
  ├── supabase db reset --no-seed           # schema + migrations; empty DB
  └── tsx supabase/seed/index.ts            # actual seeding
        ├── ensureDemoAuthUser()            # Supabase admin API, pre-transaction
        └── sql.begin(async tx => {         # single transaction
              ├── seedPlans(tx)
              ├── const demo = await seedDemoTenant(tx)
              ├── const thins = await seedThinTenants(tx)
              ├── await seedBookingsForTenant(tx, demo, { days: 90, target: 200 })
              └── for t of thins: seedBookingsForTenant(tx, t, { days: 30, target: 10 })
            })
```

Wrapping the main body in a single transaction is both a safety and a speed win. Bulk inserts in one transaction are 5-10x faster than autocommit, and a mid-seed failure leaves the DB empty (same state `db reset --no-seed` left it in), not half-seeded.

Auth user creation happens outside the transaction because the admin API doesn't share our pg connection; it's idempotent (fetch-or-create by email).

### Dataset shape

**Estudio Sónico (deep, hardcoded skeleton + generated activity):**

| Layer | Content | Source |
|---|---|---|
| auth user | `demo@bukarrum.test`, password `demo-password-123`, UUID `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | Hardcoded |
| Tenant | Estudio Sónico, slug `estudio-sonico`, Pro plan | Hardcoded |
| Locations (2) | Sede Providencia, Sede Ñuñoa (America/Santiago) | Hardcoded |
| Resources (5) | DJ Room, Production Studio A, Ciclorama, Podcast Room, Lighting Kit | Hardcoded |
| Availability | Existing per-resource weekly schedules | Hardcoded |
| Add-on services | Existing per-resource catalog (headphones, recording, engineer, photographer, editor) | Hardcoded |
| Bookers (~80) | Spanish names, emails, +56 phones | Faker |
| Bookings (~200) | 90-day window (30d past + 60d future), realistic status mix, collision-free | Faker + rules |
| Booking add-ons | ~40% of bookings pick 1-2 add-ons from their resource's catalog | Faker + catalog |
| Booking payments | Derived from booking status + plan (see rules below) | Rules |

**Thin tenants (×3, fully generated):**

- Random Spanish business name via `faker.company.name()` prefixed with one of `["Estudio", "Sala", "Ciclorama"]`
- Slug derived from name, 4-char suffix appended to avoid collisions
- Own auth user (`owner+<n>@bukarrum.test`, same password as demo)
- Plan coverage: one Starter, one Pro, one Enterprise (for plan-gate testing)
- 1-2 locations, 2-4 resources per tenant
- 0-1 add-ons per resource
- 5-15 bookings each (enough to verify RLS isolation, not enough to clutter)

**Plans:** Inserted by the TS generator itself (`seedPlans`). Keeps everything in one place so `supabase/seed.sql` is deleted entirely and `config.toml` sets `sql_paths = []`.

### Status and payment assignment rules

Past bookings mix realistic outcomes so completed/cancelled/no-show UI actually exercises:

| Bucket | status distribution |
|---|---|
| Past bookings | `completed` 70%, `cancelled` 12%, `no_show` 10%, `confirmed` 8% |
| Near-future (≤7d) | `confirmed` 85%, `pending` 15% |
| Far-future (8-60d) | `confirmed` 60%, `pending` 40% |

Payment state follows from status:

| Booking status | payment_status distribution |
|---|---|
| `completed` | `paid` 75%, `partial` 15%, `unpaid` 8%, `refunded` 2% |
| `confirmed` (past) | `paid` 60%, `partial` 20%, `unpaid` 20% |
| `confirmed` (future) | `paid` 30% (deposit), `partial` 15%, `unpaid` 55% |
| `pending` / `cancelled` / `no_show` | `unpaid` |

`refunded` bookings get a matching negative `booking_payments` row so the panel tile renders correctly. `partial` gets one payment row for a fractional amount.

### File layout

```
supabase/
├── config.toml                          # modified: sql_paths = []
├── seed.sql                             # deleted
├── seed/
│   ├── index.ts                         # entry point + orchestrator
│   ├── lib/
│   │   ├── db.ts                        # postgres connection, transaction helper
│   │   ├── faker.ts                     # seeded faker (es locale)
│   │   ├── ids.ts                       # hardcoded UUIDs for demo tenant
│   │   ├── types.ts                     # SeededTenant, SeededResource, etc.
│   │   └── admin.ts                     # Supabase service-role client for auth.users
│   └── generators/
│       ├── plans.ts                     # seedPlans(tx)
│       ├── tenants.ts                   # seedDemoTenant(tx), seedThinTenants(tx)
│       ├── bookers.ts                   # seedBookers(tx, tenantId, count)
│       └── bookings.ts                  # seedBookingsForTenant(tx, tenant, opts)
└── migrations/                          # unchanged
```

### Booking generator structure

The booking generator is the most complex piece, so it's explicitly split into pure decision functions and DB-touching functions:

```ts
// Pure (no DB) — easy to reason about and test later if needed
function pickSlot(resource, window, existingBookings): Slot | null
function assignStatus(startTime, now): BookingStatus
function assignPaymentState(status, totalPrice, startTime, now): PaymentPlan
function pickAddOns(resource, addOns, durationHours): AddOnPick[]

// DB functions — dumb, predictable inserts
async function insertBooking(tx, data): string
async function insertBookingAddOns(tx, bookingId, picks)
async function insertPayments(tx, bookingId, plan)
```

Collision detection is in-memory (an array of `{resourceId, start, end}` for already-inserted bookings) rather than a DB roundtrip per candidate. Combined with bulk inserts in a single transaction, this keeps the whole seed within the <5s budget (goal 4), typically around 2-3s on a modern laptop.

### Determinism & faker seeding

`faker.seed(42)` is set at module load, so every reset produces the same generated tenants, bookers, bookings, and notes. This gives:
- Stable IDs even for "random" rows (good for iterating on a bug)
- Optional variety via `FAKER_SEED=xxx npm run db:seed` when you want fresh data

The demo tenant's IDs live in `supabase/seed/lib/ids.ts`:

```ts
export const DEMO = {
  authUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantSlug: 'estudio-sonico',
  locationProvidenciaId: '22222222-2222-2222-2222-222222222222',
  locationNunoaId: '33333333-3333-3333-3333-333333333333',
  resources: {
    djRoom: 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productionStudioA: 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ciclorama: 'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    podcastRoom: 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    lightingKit: 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  },
} as const;
```

These match the current hand-written seed exactly, so anything already bookmarked or referenced keeps working on day one.

### Safety rails

1. **Localhost guard.** `index.ts` asserts `SUPABASE_DB_URL` contains `localhost` or `127.0.0.1` and throws otherwise. No possibility of accidentally seeding staging or prod.
2. **Fail loud.** All errors propagate. No `try/catch` swallowing. A broken seed should be fixed, not worked around.
3. **Single-transaction atomicity.** Mid-seed failure rolls back to empty DB.
4. **No standalone `db:seed`.** Documented as "always run `db:reset`". Running `db:seed` twice without a reset will fail on unique constraints — expected behavior.

### package.json scripts

```jsonc
{
  "scripts": {
    "db:seed": "tsx --env-file=.env.local supabase/seed/index.ts",
    "db:reset": "supabase db reset --no-seed && npm run db:seed"
  }
}
```

`tsx` is invoked directly (not via `node --import tsx`) because direct invocation is the stable, documented entry point and works uniformly across Node 20+ versions. `tsx` supports Node's `--env-file` flag natively via passthrough.

The existing `npx supabase db reset` workflow continues to work but runs the empty-no-seed version. Developers are directed to `npm run db:reset` for the full experience.

### config.toml

```toml
[db.seed]
enabled = false
sql_paths = []
```

### Dependencies added

```jsonc
{
  "devDependencies": {
    "@faker-js/faker": "^9",
    "postgres": "^3",
    "tsx": "^4"
  }
}
```

No runtime dependencies added. All seed tooling is dev-only.

## Rollout

1. Implement the generator in a feature branch (includes deleting `supabase/seed.sql` and updating `config.toml`).
2. Run `npm run db:reset` locally and verify:
   - Can log in as `demo@bukarrum.test`
   - Calendar shows bookings in both past and future weeks
   - Analytics charts are populated
   - Top customers list has variety
   - Payments panel shows a mix of paid/partial/refunded
   - Logging in as a thin tenant shows a clean RLS-isolated view
3. Update the `## Development Commands` section of [CLAUDE.md](../../../CLAUDE.md) to document `npm run db:reset` as the canonical reset command.
4. Merge.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Schema migration adds a required column, seed breaks silently | Postgres raises on insert; script fails loud. Fix as part of the migration PR. |
| Generated data collides with hand-written unique constraints (slug, email) | Faker seed is deterministic; collisions will surface on first run and can be fixed by suffixing. |
| Script runs against non-local DB by mistake | Localhost guard in `index.ts`. |
| Script is slow enough to discourage resets | Single-transaction bulk inserts; in-memory collision check. Target <5s, monitor in practice. |
| Faker locale `es` produces Spain-ish data instead of Chilean | Override with small custom pools for business names and phone format (`+56 9 xxxx xxxx`). Acceptable for dev. |

## Open questions

None after Section 4 approval.
