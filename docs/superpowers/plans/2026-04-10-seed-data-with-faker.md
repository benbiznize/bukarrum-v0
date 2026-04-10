# Seed Data with Faker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 190-line hand-written `supabase/seed.sql` with a TypeScript seed generator built on `@faker-js/faker` that produces a rich, deterministic, multi-tenant dataset on every `npm run db:reset`.

**Architecture:** `tsx`-executed TypeScript script at `supabase/seed/index.ts`. Orchestrator opens a single `postgres` transaction, seeds plans + a hardcoded Estudio Sónico skeleton + 3 generated thin tenants, then generates ~200 bookings with realistic status/payment distributions for the demo and ~10 for each thin tenant. A Supabase service-role client handles the `auth.users` entry outside the transaction. Faker is seeded with `42` so every reset produces the same output.

**Tech Stack:** TypeScript (strict), `@faker-js/faker` (es locale), `tsx`, `postgres` (pg-wire npm package), `@supabase/supabase-js` (admin API only), Node 20 `--env-file`.

**Spec:** [docs/superpowers/specs/2026-04-10-seed-data-with-faker-design.md](../specs/2026-04-10-seed-data-with-faker-design.md)

---

## File Structure

```
supabase/
├── config.toml                          # modified: [db.seed] disabled
├── seed.sql                             # deleted at end
├── seed/
│   ├── index.ts                         # entry point + orchestrator
│   ├── lib/
│   │   ├── db.ts                        # postgres connection + localhost guard
│   │   ├── faker.ts                     # seeded Faker instance (es locale)
│   │   ├── ids.ts                       # hardcoded DEMO UUIDs
│   │   ├── types.ts                     # SeededTenant / SeededResource / etc.
│   │   └── admin.ts                     # service-role client, ensureDemoAuthUser
│   └── generators/
│       ├── plans.ts                     # seedPlans
│       ├── tenants.ts                   # seedDemoTenant + seedThinTenants
│       ├── bookers.ts                   # seedBookers
│       └── bookings.ts                  # seedBookingsForTenant (+ pure helpers)
└── migrations/                          # unchanged
```

Every file has one clear responsibility. `lib/` is side-effect-free helpers; `generators/` contains the actual insert logic; `index.ts` wires them together inside one transaction.

---

## Task 1: Install dependencies and wire up npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install devDependencies**

Run:
```bash
npm install --save-dev @faker-js/faker@^9 postgres@^3 tsx@^4
```

Expected: `package.json` `devDependencies` gains `@faker-js/faker`, `postgres`, and `tsx`. `package-lock.json` updates. No runtime dependencies added.

- [ ] **Step 2: Add `db:seed` and `db:reset` scripts**

Edit `package.json` scripts block. Before:
```jsonc
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "type-check": "tsc --noEmit",
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui"
  },
```

After:
```jsonc
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "type-check": "tsc --noEmit",
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui",
    "db:seed": "tsx --env-file=.env.local supabase/seed/index.ts",
    "db:reset": "supabase db reset --no-seed && npm run db:seed"
  },
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add faker/postgres/tsx for seed generator + db:reset script"
```

---

## Task 2: Turn off the SQL seeder in config.toml

**Files:**
- Modify: `supabase/config.toml:60-66`

- [ ] **Step 1: Edit `[db.seed]` block**

Replace:
```toml
[db.seed]
# If enabled, seeds the database after migrations during a db reset.
enabled = true
# Specifies an ordered list of seed files to load during db reset.
# Supports glob patterns relative to supabase directory: "./seeds/*.sql"
sql_paths = ["./seed.sql"]
```

With:
```toml
[db.seed]
# Disabled: seeding is handled by `npm run db:reset` which runs
# `supabase db reset --no-seed` then `tsx supabase/seed/index.ts`.
enabled = false
sql_paths = []
```

Note: `seed.sql` itself stays in place for now — we delete it in Task 14 after the TS seed is fully working, so git history shows the removal alongside the passing replacement.

- [ ] **Step 2: Commit**

```bash
git add supabase/config.toml
git commit -m "chore(supabase): disable SQL seeder in config.toml"
```

---

## Task 3: Hardcoded demo IDs

**Files:**
- Create: `supabase/seed/lib/ids.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/lib/ids.ts` with:

```ts
/**
 * Stable UUIDs and identifiers for the demo tenant.
 * These MUST match any hardcoded references in tests,
 * bookmarks, or docs. Do not change without updating call sites.
 */
export const DEMO = {
  authUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'demo@bukarrum.test',
  password: 'demo-password-123',

  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantSlug: 'estudio-sonico',
  tenantName: 'Estudio Sónico',

  locations: {
    providencia: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Sede Providencia',
      slug: 'providencia',
      address: 'Av. Providencia 1234',
      city: 'Santiago',
      timezone: 'America/Santiago',
    },
    nunoa: {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Sede Ñuñoa',
      slug: 'nunoa',
      address: 'Irarrázaval 567',
      city: 'Santiago',
      timezone: 'America/Santiago',
    },
  },

  resources: {
    djRoom:            'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productionStudioA: 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ciclorama:         'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    podcastRoom:       'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    lightingKit:       'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  },
} as const;

export const PLAN_SLUGS = ['starter', 'pro', 'enterprise'] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (file is only constants; no external imports).

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/lib/ids.ts
git commit -m "feat(seed): add DEMO constants module"
```

---

## Task 4: Postgres connection + localhost guard

**Files:**
- Create: `supabase/seed/lib/db.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/lib/db.ts` with:

```ts
import postgres from 'postgres';

/**
 * Default points at the Supabase local dev DB.
 * Override with SUPABASE_DB_URL if you've changed the port.
 *
 * Uses the `postgres` superuser connection string — this bypasses
 * RLS, which is exactly what we want for seeding.
 */
const DEFAULT_LOCAL_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres';

export function getDatabaseUrl(): string {
  return process.env.SUPABASE_DB_URL ?? DEFAULT_LOCAL_URL;
}

/**
 * Safety rail: refuse to seed anything that isn't localhost.
 * Throws synchronously before any connection is opened.
 */
export function assertLocalhost(url: string): void {
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('host.docker.internal');
  if (!isLocal) {
    throw new Error(
      `[seed] Refusing to run against non-local database: ${url.replace(/:[^:@]*@/, ':***@')}`,
    );
  }
}

/**
 * Opens a short-lived `postgres` client. Callers are responsible for
 * closing it via `await sql.end()` in a finally block.
 */
export function createSqlClient() {
  const url = getDatabaseUrl();
  assertLocalhost(url);
  return postgres(url, {
    // Fail fast: we want a hard error in dev, not a 30s wait.
    connect_timeout: 5,
    // Raw error messages are more useful than masked ones.
    onnotice: () => {},
  });
}

export type Sql = ReturnType<typeof createSqlClient>;
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/lib/db.ts
git commit -m "feat(seed): add postgres client + localhost guard"
```

---

## Task 5: Seeded Faker instance (es locale)

**Files:**
- Create: `supabase/seed/lib/faker.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/lib/faker.ts` with:

```ts
import { Faker, es } from '@faker-js/faker';

/**
 * Deterministic faker for seed data.
 *
 * `faker.seed(n)` makes every generator call reproducible, which means
 * every `db:reset` produces the exact same tenants, bookers, notes, etc.
 * Override with FAKER_SEED=... when you want fresh variety.
 */
const seedEnv = process.env.FAKER_SEED;
const SEED = seedEnv ? Number.parseInt(seedEnv, 10) : 42;

export const fakerEs = new Faker({ locale: [es] });
fakerEs.seed(Number.isFinite(SEED) ? SEED : 42);

/**
 * Chilean mobile number generator. The faker `es` locale produces
 * Spain-style numbers, so we roll our own to keep bookers realistic
 * and consistent with the CL domain.
 */
export function chileanPhone(): string {
  const block1 = String(fakerEs.number.int({ min: 1000, max: 9999 })).padStart(4, '0');
  const block2 = String(fakerEs.number.int({ min: 1000, max: 9999 })).padStart(4, '0');
  return `+569${block1}${block2}`;
}

/**
 * Slugify helper. Lowercases, strips accents, replaces non-alphanumeric
 * runs with `-`, trims leading/trailing hyphens. Matches the slug format
 * constraint enforced by the DB.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS. Faker v9 uses the `new Faker({ locale: [...] })` constructor — this is the stable API from v8 onward.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/lib/faker.ts
git commit -m "feat(seed): add seeded faker instance + CL phone helper"
```

---

## Task 6: Service-role admin client + ensureDemoAuthUser

**Files:**
- Create: `supabase/seed/lib/admin.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/lib/admin.ts` with:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO } from './ids';

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      '[seed] SUPABASE_SERVICE_ROLE_KEY is required. Is it set in .env.local?',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Idempotent: creates the demo auth user if missing, otherwise
 * updates the password/id to match DEMO. This is called BEFORE the
 * main pg transaction because the admin API doesn't share our
 * connection.
 *
 * `supabase db reset --no-seed` wipes auth.users, so in the normal
 * flow we always hit the "create" branch. The "already exists" branch
 * exists purely for safety when someone runs `db:seed` alone.
 */
export async function ensureDemoAuthUser(): Promise<void> {
  const admin = adminClient();

  // Supabase's admin API has no "get by id" that returns missing as null,
  // so we check by listing and filtering. 1000 is more than enough for dev.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const already = existing.users.find((u) => u.email === DEMO.email);
  if (already) {
    if (already.id !== DEMO.authUserId) {
      throw new Error(
        `[seed] ${DEMO.email} exists with id ${already.id}, expected ${DEMO.authUserId}. Run \`supabase db reset\` first.`,
      );
    }
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    id: DEMO.authUserId,
    email: DEMO.email,
    password: DEMO.password,
    email_confirm: true,
    user_metadata: { seeded: true },
  });
  if (error) throw error;
}

/**
 * Create a thin-tenant owner. Not idempotent — callers must run against
 * an empty auth.users table (i.e., immediately after `db reset`).
 *
 * Returns the newly-minted user id, which the caller stores in tenants.user_id.
 */
export async function createThinTenantOwner(index: number): Promise<string> {
  const admin = adminClient();
  const email = `owner+${index}@bukarrum.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO.password,
    email_confirm: true,
    user_metadata: { seeded: true, thin_index: index },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`[seed] createUser returned no user for ${email}`);
  return data.user.id;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/lib/admin.ts
git commit -m "feat(seed): add service-role admin client + auth user helpers"
```

---

## Task 7: Shared types

**Files:**
- Create: `supabase/seed/lib/types.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/lib/types.ts` with:

```ts
/**
 * Minimal shapes used by the generators. These are narrower than the
 * full row types because the seed only needs the columns it reads back.
 */

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export interface SeededAvailability {
  dayOfWeek: DayOfWeek;
  /** 24h "HH:MM" */
  startTime: string;
  /** 24h "HH:MM" */
  endTime: string;
}

export interface SeededAddOn {
  id: string;
  name: string;
  pricingMode: 'hourly' | 'flat';
  unitPrice: number;
}

export interface SeededResource {
  id: string;
  name: string;
  type: 'room' | 'equipment';
  hourlyRate: number;
  minDurationHours: number;
  maxDurationHours: number;
  /** location ids this resource is available at */
  locationIds: string[];
  availability: SeededAvailability[];
  addOns: SeededAddOn[];
}

export interface SeededLocation {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  timezone: string;
}

export interface SeededTenant {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  planSlug: 'starter' | 'pro' | 'enterprise';
  locations: SeededLocation[];
  resources: SeededResource[];
}

export interface BookingOptions {
  /** Total window in days, split roughly 1/3 past, 2/3 future. */
  windowDays: number;
  /** Target booking count (best-effort — collisions may reduce this). */
  target: number;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/lib/types.ts
git commit -m "feat(seed): add shared Seeded* types"
```

---

## Task 8: Plans generator

**Files:**
- Create: `supabase/seed/generators/plans.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/generators/plans.ts` with:

```ts
import type { Sql } from '../lib/db';

/**
 * Inserts the 3-tier CLP plan catalog. Prices and feature gates
 * match what was in supabase/seed.sql before the rewrite.
 *
 * Returns a map from slug -> plan id for downstream use.
 */
export async function seedPlans(sql: Sql): Promise<Record<string, string>> {
  const rows = [
    {
      name: 'Starter',
      slug: 'starter',
      price_monthly: 29990,
      price_annual: 299900,
      features: {
        locations: 1,
        resources_per_location: 3,
        bookings_per_month: 30,
        add_ons: false,
        analytics: false,
      },
      display_order: 1,
    },
    {
      name: 'Pro',
      slug: 'pro',
      price_monthly: 59990,
      price_annual: 599900,
      features: {
        locations: 3,
        resources_per_location: 10,
        bookings_per_month: 200,
        add_ons: true,
        analytics: false,
      },
      display_order: 2,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      price_monthly: 99990,
      price_annual: 999900,
      features: {
        locations: -1,
        resources_per_location: -1,
        bookings_per_month: -1,
        add_ons: true,
        analytics: true,
      },
      display_order: 3,
    },
  ];

  const inserted = await sql<{ id: string; slug: string }[]>`
    insert into public.plans ${sql(
      rows,
      'name',
      'slug',
      'price_monthly',
      'price_annual',
      'features',
      'display_order',
    )}
    returning id, slug
  `;

  const map: Record<string, string> = {};
  for (const row of inserted) map[row.slug] = row.id;
  return map;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/generators/plans.ts
git commit -m "feat(seed): add plans generator"
```

---

## Task 9: Demo tenant generator

**Files:**
- Create: `supabase/seed/generators/tenants.ts`

- [ ] **Step 1: Create the file with `seedDemoTenant`**

Write `supabase/seed/generators/tenants.ts` with:

```ts
import type { Sql } from '../lib/db';
import { DEMO } from '../lib/ids';
import type {
  SeededAddOn,
  SeededResource,
  SeededTenant,
  DayOfWeek,
} from '../lib/types';

/**
 * Insert the hardcoded Estudio Sónico skeleton: tenant, subscription,
 * locations, resources, resource_locations, availability, add-ons.
 *
 * Returns a normalized SeededTenant the booking generator can consume.
 */
export async function seedDemoTenant(
  sql: Sql,
  planIdBySlug: Record<string, string>,
): Promise<SeededTenant> {
  const { providencia, nunoa } = DEMO.locations;

  // Tenant
  await sql`
    insert into public.tenants (id, user_id, name, slug)
    values (${DEMO.tenantId}, ${DEMO.authUserId}, ${DEMO.tenantName}, ${DEMO.tenantSlug})
  `;

  // Subscription (Pro)
  await sql`
    insert into public.subscriptions
      (tenant_id, plan_id, status, current_period_start, current_period_end)
    values (
      ${DEMO.tenantId},
      ${planIdBySlug.pro},
      'active',
      now(),
      now() + interval '30 days'
    )
  `;

  // Locations
  await sql`
    insert into public.locations
      (id, tenant_id, name, slug, address, city, timezone)
    values
      (${providencia.id}, ${DEMO.tenantId}, ${providencia.name}, ${providencia.slug},
       ${providencia.address}, ${providencia.city}, ${providencia.timezone}),
      (${nunoa.id},       ${DEMO.tenantId}, ${nunoa.name},       ${nunoa.slug},
       ${nunoa.address},  ${nunoa.city},    ${nunoa.timezone})
  `;

  // Resources (tenant-scoped)
  const resourceSeeds: Array<{
    id: string;
    name: string;
    description: string;
    type: 'room' | 'equipment';
    hourlyRate: number;
    minH: number;
    maxH: number;
    locationIds: string[];
    availability: Array<{ day: DayOfWeek; start: string; end: string }>;
    addOns: Array<{ name: string; description: string; mode: 'hourly' | 'flat'; price: number }>;
  }> = [
    {
      id: DEMO.resources.djRoom,
      name: 'Sala de Ensayo DJ',
      description: 'Sala equipada con CDJs Pioneer, mixer DJM-900, y monitores KRK',
      type: 'room',
      hourlyRate: 15000,
      minH: 1,
      maxH: 4,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday'], '10:00', '22:00'),
      addOns: [
        { name: 'Arriendo de Audífonos', description: 'Audífonos DJ profesionales Pioneer HDJ-X7', mode: 'flat',   price: 5000 },
        { name: 'Pendrive con Música',    description: 'Pendrive cargado con set curado de tracks',  mode: 'flat',   price: 3000 },
        { name: 'Grabación de Audio',     description: 'Grabación profesional del set completo',     mode: 'hourly', price: 8000 },
      ],
    },
    {
      id: DEMO.resources.productionStudioA,
      name: 'Estudio de Producción A',
      description: 'Producción musical con Pro Tools, interfaz Apollo, y monitores Genelec',
      type: 'room',
      hourlyRate: 25000,
      minH: 2,
      maxH: 8,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday'], '09:00', '23:00'),
      addOns: [
        { name: 'Ingeniero de Sonido', description: 'Técnico profesional para grabación y mezcla en vivo', mode: 'hourly', price: 20000 },
      ],
    },
    {
      id: DEMO.resources.ciclorama,
      name: 'Ciclorama',
      description: 'Ciclorama blanco 4x6m para fotografía y video',
      type: 'room',
      hourlyRate: 35000,
      minH: 2,
      maxH: 8,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], '08:00', '20:00'),
      addOns: [
        { name: 'Fotógrafo', description: 'Fotógrafo profesional para sesiones en ciclorama', mode: 'hourly', price: 25000 },
      ],
    },
    {
      id: DEMO.resources.podcastRoom,
      name: 'Sala de Podcasting',
      description: 'Sala acústica con 4 micrófonos Shure SM7B y grabadora Rodecaster',
      type: 'room',
      hourlyRate: 12000,
      minH: 1,
      maxH: 4,
      locationIds: [nunoa.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday'], '09:00', '21:00'),
      addOns: [
        { name: 'Editor de Podcast', description: 'Post-producción y edición de audio para tu podcast', mode: 'flat', price: 15000 },
      ],
    },
    {
      id: DEMO.resources.lightingKit,
      name: 'Kit de Iluminación',
      description: 'Kit completo Godox con 3 luces, softboxes y trípodes',
      type: 'equipment',
      hourlyRate: 8000,
      minH: 1,
      maxH: 8,
      locationIds: [providencia.id, nunoa.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], '08:00', '22:00'),
      addOns: [],
    },
  ];

  // Insert resources in one batch
  await sql`
    insert into public.resources ${sql(
      resourceSeeds.map((r) => ({
        id: r.id,
        tenant_id: DEMO.tenantId,
        name: r.name,
        description: r.description,
        type: r.type,
        hourly_rate: r.hourlyRate,
        min_duration_hours: r.minH,
        max_duration_hours: r.maxH,
      })),
      'id',
      'tenant_id',
      'name',
      'description',
      'type',
      'hourly_rate',
      'min_duration_hours',
      'max_duration_hours',
    )}
  `;

  // Resource <-> location junction rows
  const rlRows = resourceSeeds.flatMap((r) =>
    r.locationIds.map((locId) => ({ resource_id: r.id, location_id: locId })),
  );
  await sql`
    insert into public.resource_locations ${sql(rlRows, 'resource_id', 'location_id')}
  `;

  // Availability rows
  const availRows = resourceSeeds.flatMap((r) =>
    r.availability.map((a) => ({
      resource_id: r.id,
      day_of_week: a.day,
      start_time: a.start,
      end_time: a.end,
    })),
  );
  await sql`
    insert into public.availability ${sql(
      availRows,
      'resource_id',
      'day_of_week',
      'start_time',
      'end_time',
    )}
  `;

  // Add-ons — collect ids as we go so we can return them in the SeededResource
  const addOnRowsByResource = new Map<string, SeededAddOn[]>();
  const addOnRowsFlat = resourceSeeds.flatMap((r) =>
    r.addOns.map((a) => ({
      resource_id: r.id,
      name: a.name,
      description: a.description,
      pricing_mode: a.mode,
      unit_price: a.price,
    })),
  );

  if (addOnRowsFlat.length > 0) {
    const inserted = await sql<{ id: string; resource_id: string; name: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }[]>`
      insert into public.add_on_services ${sql(
        addOnRowsFlat,
        'resource_id',
        'name',
        'description',
        'pricing_mode',
        'unit_price',
      )}
      returning id, resource_id, name, pricing_mode, unit_price
    `;
    for (const row of inserted) {
      const list = addOnRowsByResource.get(row.resource_id) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        pricingMode: row.pricing_mode,
        unitPrice: row.unit_price,
      });
      addOnRowsByResource.set(row.resource_id, list);
    }
  }

  const resources: SeededResource[] = resourceSeeds.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    hourlyRate: r.hourlyRate,
    minDurationHours: r.minH,
    maxDurationHours: r.maxH,
    locationIds: r.locationIds,
    availability: r.availability.map((a) => ({
      dayOfWeek: a.day,
      startTime: a.start,
      endTime: a.end,
    })),
    addOns: addOnRowsByResource.get(r.id) ?? [],
  }));

  return {
    id: DEMO.tenantId,
    name: DEMO.tenantName,
    slug: DEMO.tenantSlug,
    ownerUserId: DEMO.authUserId,
    planSlug: 'pro',
    locations: [
      { id: providencia.id, name: providencia.name, slug: providencia.slug, address: providencia.address, city: providencia.city, timezone: providencia.timezone },
      { id: nunoa.id,       name: nunoa.name,       slug: nunoa.slug,       address: nunoa.address,       city: nunoa.city,       timezone: nunoa.timezone },
    ],
    resources,
  };
}

function weekdays(days: DayOfWeek[], start: string, end: string) {
  return days.map((day) => ({ day, start, end }));
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/generators/tenants.ts
git commit -m "feat(seed): add demo tenant generator"
```

---

## Task 10: Thin tenants generator

**Files:**
- Modify: `supabase/seed/generators/tenants.ts`

- [ ] **Step 1: Extend imports for the thin-tenant generator**

At the top of `supabase/seed/generators/tenants.ts`, update the existing imports to include the new symbols used by `seedThinTenants`:

```ts
// Change:
import { DEMO } from '../lib/ids';
// To:
import { DEMO, PLAN_SLUGS } from '../lib/ids';

// And add this new import line below the existing ones:
import { fakerEs, slugify } from '../lib/faker';
```

(The orchestrator in `index.ts` creates thin-tenant auth users directly via `createThinTenantOwner`, so we do NOT import it here.)

- [ ] **Step 2: Append `seedThinTenants` to the existing file**

At the bottom of `supabase/seed/generators/tenants.ts`, append:

```ts
/**
 * Creates 3 fully-generated thin tenants, one per plan tier.
 * Used to exercise RLS isolation and plan gating in a dev environment.
 *
 * Auth users are created BEFORE this function because the admin API
 * cannot be called inside the pg transaction — see index.ts.
 */
export async function seedThinTenants(
  sql: Sql,
  planIdBySlug: Record<string, string>,
  ownerUserIds: string[],
): Promise<SeededTenant[]> {
  if (ownerUserIds.length !== PLAN_SLUGS.length) {
    throw new Error(
      `[seed] expected ${PLAN_SLUGS.length} thin-tenant owners, got ${ownerUserIds.length}`,
    );
  }

  const tenants: SeededTenant[] = [];

  for (let i = 0; i < PLAN_SLUGS.length; i++) {
    const planSlug = PLAN_SLUGS[i];
    const ownerUserId = ownerUserIds[i];
    const prefix = fakerEs.helpers.arrayElement(['Estudio', 'Sala', 'Ciclorama']);
    const suffix = fakerEs.company.name().split(/\s+/)[0];
    const name = `${prefix} ${suffix}`;
    const suffixHash = fakerEs.string.alphanumeric({ length: 4, casing: 'lower' });
    const slug = `${slugify(name)}-${suffixHash}`;

    // Tenant row
    const [{ id: tenantId }] = await sql<{ id: string }[]>`
      insert into public.tenants (user_id, name, slug)
      values (${ownerUserId}, ${name}, ${slug})
      returning id
    `;

    // Subscription
    await sql`
      insert into public.subscriptions
        (tenant_id, plan_id, status, current_period_start, current_period_end)
      values (
        ${tenantId},
        ${planIdBySlug[planSlug]},
        'active',
        now(),
        now() + interval '30 days'
      )
    `;

    // 1-2 locations
    const locationCount = fakerEs.number.int({ min: 1, max: 2 });
    const locationRows = Array.from({ length: locationCount }, (_, idx) => {
      const city = fakerEs.helpers.arrayElement(['Santiago', 'Valparaíso', 'Concepción']);
      const locName = `Sede ${fakerEs.location.street()}`;
      return {
        tenant_id: tenantId,
        name: locName,
        slug: `${slugify(locName)}-${idx + 1}`,
        address: fakerEs.location.streetAddress(),
        city,
        timezone: 'America/Santiago',
      };
    });
    const insertedLocations = await sql<{ id: string; name: string; slug: string; address: string; city: string; timezone: string }[]>`
      insert into public.locations ${sql(
        locationRows,
        'tenant_id',
        'name',
        'slug',
        'address',
        'city',
        'timezone',
      )}
      returning id, name, slug, address, city, timezone
    `;

    // 2-4 resources
    const resourceCount = fakerEs.number.int({ min: 2, max: 4 });
    const resourceSeeds = Array.from({ length: resourceCount }, () => {
      const hourlyRate = fakerEs.number.int({ min: 8, max: 40 }) * 1000;
      const name = fakerEs.helpers.arrayElement([
        'Sala de Ensayo', 'Estudio de Grabación', 'Ciclorama', 'Sala de Podcast',
        'Salón Principal', 'Estudio B', 'Sala Acústica', 'Box de Ensayo',
      ]);
      return {
        tenant_id: tenantId,
        name,
        description: fakerEs.lorem.sentence({ min: 6, max: 12 }),
        type: 'room' as const,
        hourly_rate: hourlyRate,
        min_duration_hours: 1,
        max_duration_hours: 4,
      };
    });
    const insertedResources = await sql<{ id: string; name: string; type: 'room' | 'equipment'; hourly_rate: number; min_duration_hours: number; max_duration_hours: number }[]>`
      insert into public.resources ${sql(
        resourceSeeds,
        'tenant_id',
        'name',
        'description',
        'type',
        'hourly_rate',
        'min_duration_hours',
        'max_duration_hours',
      )}
      returning id, name, type, hourly_rate, min_duration_hours, max_duration_hours
    `;

    // Attach every resource to every location (simple, realistic)
    const rlRows = insertedResources.flatMap((r) =>
      insertedLocations.map((loc) => ({ resource_id: r.id, location_id: loc.id })),
    );
    await sql`
      insert into public.resource_locations ${sql(rlRows, 'resource_id', 'location_id')}
    `;

    // Availability: Mon-Sat 09:00-21:00 for every resource
    const days: DayOfWeek[] = ['monday','tuesday','wednesday','thursday','friday','saturday'];
    const availRows = insertedResources.flatMap((r) =>
      days.map((day) => ({
        resource_id: r.id,
        day_of_week: day,
        start_time: '09:00',
        end_time: '21:00',
      })),
    );
    await sql`
      insert into public.availability ${sql(
        availRows,
        'resource_id',
        'day_of_week',
        'start_time',
        'end_time',
      )}
    `;

    // 0-1 add-ons per resource
    const addOnRowsFlat: Array<{ resource_id: string; name: string; description: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }> = [];
    for (const r of insertedResources) {
      if (fakerEs.datatype.boolean()) {
        addOnRowsFlat.push({
          resource_id: r.id,
          name: fakerEs.helpers.arrayElement(['Arriendo de Audífonos','Servicio de Catering','Fotógrafo','Técnico de Sonido']),
          description: fakerEs.lorem.sentence({ min: 4, max: 8 }),
          pricing_mode: fakerEs.helpers.arrayElement(['hourly','flat'] as const),
          unit_price: fakerEs.number.int({ min: 3, max: 20 }) * 1000,
        });
      }
    }

    const addOnsByResource = new Map<string, SeededAddOn[]>();
    if (addOnRowsFlat.length > 0) {
      const inserted = await sql<{ id: string; resource_id: string; name: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }[]>`
        insert into public.add_on_services ${sql(
          addOnRowsFlat,
          'resource_id',
          'name',
          'description',
          'pricing_mode',
          'unit_price',
        )}
        returning id, resource_id, name, pricing_mode, unit_price
      `;
      for (const row of inserted) {
        const list = addOnsByResource.get(row.resource_id) ?? [];
        list.push({ id: row.id, name: row.name, pricingMode: row.pricing_mode, unitPrice: row.unit_price });
        addOnsByResource.set(row.resource_id, list);
      }
    }

    const resources: SeededResource[] = insertedResources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      hourlyRate: r.hourly_rate,
      minDurationHours: r.min_duration_hours,
      maxDurationHours: r.max_duration_hours,
      locationIds: insertedLocations.map((l) => l.id),
      availability: days.map((day) => ({ dayOfWeek: day, startTime: '09:00', endTime: '21:00' })),
      addOns: addOnsByResource.get(r.id) ?? [],
    }));

    tenants.push({
      id: tenantId,
      name,
      slug,
      ownerUserId,
      planSlug,
      locations: insertedLocations.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        address: l.address,
        city: l.city,
        timezone: l.timezone,
      })),
      resources,
    });
  }

  return tenants;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/generators/tenants.ts
git commit -m "feat(seed): add thin tenants generator"
```

---

## Task 11: Bookers generator

**Files:**
- Create: `supabase/seed/generators/bookers.ts`

- [ ] **Step 1: Create the file**

Write `supabase/seed/generators/bookers.ts` with:

```ts
import type { Sql } from '../lib/db';
import { fakerEs, chileanPhone } from '../lib/faker';

/**
 * Inserts N unique bookers and returns their ids. Uses a running
 * counter in email local-part to guarantee uniqueness even under
 * faker collisions.
 */
export async function seedBookers(sql: Sql, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, (_, i) => {
    const firstName = fakerEs.person.firstName();
    const lastName = fakerEs.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = `${slug(firstName)}.${slug(lastName)}.${i + 1}@example.cl`;
    return {
      email,
      name,
      phone: chileanPhone(),
    };
  });

  const inserted = await sql<{ id: string }[]>`
    insert into public.bookers ${sql(rows, 'email', 'name', 'phone')}
    returning id
  `;
  return inserted.map((r) => r.id);
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/generators/bookers.ts
git commit -m "feat(seed): add bookers generator"
```

---

## Task 12: Booking generator — pure decision helpers

**Files:**
- Create: `supabase/seed/generators/bookings.ts` (first half)

- [ ] **Step 1: Create the file with pure helpers**

Write `supabase/seed/generators/bookings.ts` with:

```ts
import { fakerEs } from '../lib/faker';
import type {
  SeededAddOn,
  SeededResource,
  SeededTenant,
} from '../lib/types';

// ------------------------------------------------------------------
// Pure decision helpers (no DB). Separating these makes the logic easy
// to reason about and would let us unit-test later if bugs appear.
// ------------------------------------------------------------------

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

interface SlotCandidate {
  resourceId: string;
  locationId: string;
  start: Date;
  end: Date;
  durationHours: number;
}

interface ExistingSlot {
  resourceId: string;
  start: number;
  end: number;
}

interface PaymentPlan {
  status: PaymentStatus;
  /** Entries to insert into booking_payments. Empty for unpaid. */
  entries: Array<{ amount: number; entryType: 'payment' | 'refund'; method: 'cash' | 'transfer' | 'card' | 'mercadopago' | 'other' }>;
}

const DAY_INDEX_TO_NAME = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

/**
 * Pick a candidate slot for a booking.
 *
 * Strategy: pick a random day in the window, a random resource, read
 * the resource's availability for that day, pick a random start hour
 * inside the window, pick a duration between min/max. Bail out if the
 * slot collides with any existing booking (checked in-memory).
 *
 * Returns null when we fail to find a non-colliding slot after a few
 * attempts — caller advances and tries again.
 */
export function pickSlot(
  tenant: SeededTenant,
  windowDays: number,
  now: Date,
  existing: ExistingSlot[],
): SlotCandidate | null {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const resource = fakerEs.helpers.arrayElement(tenant.resources);
    const locationId = fakerEs.helpers.arrayElement(resource.locationIds);

    // Past:future split roughly 1/3 : 2/3
    const pastDays = Math.floor(windowDays / 3);
    const futureDays = windowDays - pastDays;
    const dayOffset = fakerEs.number.int({ min: -pastDays, max: futureDays });

    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    day.setUTCHours(0, 0, 0, 0);
    const dayName = DAY_INDEX_TO_NAME[day.getUTCDay()];

    const availability = resource.availability.find((a) => a.dayOfWeek === dayName);
    if (!availability) continue;

    const [startH, startM] = availability.startTime.split(':').map((v) => Number.parseInt(v, 10));
    const [endH, endM] = availability.endTime.split(':').map((v) => Number.parseInt(v, 10));
    const windowStartMinutes = startH * 60 + startM;
    const windowEndMinutes = endH * 60 + endM;

    const duration = fakerEs.number.int({
      min: resource.minDurationHours,
      max: resource.maxDurationHours,
    });
    const durationMinutes = duration * 60;
    if (windowEndMinutes - windowStartMinutes < durationMinutes) continue;

    // Align to whole hours for realism.
    const latestStartMinutes = windowEndMinutes - durationMinutes;
    const startHourCandidate = fakerEs.number.int({
      min: Math.ceil(windowStartMinutes / 60),
      max: Math.floor(latestStartMinutes / 60),
    });

    const start = new Date(day);
    start.setUTCHours(startHourCandidate, 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const collision = existing.some(
      (e) =>
        e.resourceId === resource.id &&
        e.start < end.getTime() &&
        e.end > start.getTime(),
    );
    if (collision) continue;

    return {
      resourceId: resource.id,
      locationId,
      start,
      end,
      durationHours: duration,
    };
  }
  return null;
}

/**
 * Roll a realistic booking status based on when the booking starts
 * relative to `now`. Distributions come from the design spec.
 */
export function assignStatus(start: Date, now: Date): BookingStatus {
  const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const roll = fakerEs.number.float({ min: 0, max: 1 });

  if (diffDays < 0) {
    // Past
    if (roll < 0.70) return 'completed';
    if (roll < 0.82) return 'cancelled';
    if (roll < 0.92) return 'no_show';
    return 'confirmed';
  }
  if (diffDays <= 7) {
    // Near future
    if (roll < 0.85) return 'confirmed';
    return 'pending';
  }
  // Far future
  if (roll < 0.60) return 'confirmed';
  return 'pending';
}

/**
 * Decide payment rows given a status + the booking's total price.
 * Matches the distributions in the design spec.
 */
export function assignPaymentState(
  status: BookingStatus,
  totalPrice: number,
  start: Date,
  now: Date,
): PaymentPlan {
  const roll = fakerEs.number.float({ min: 0, max: 1 });
  const method = fakerEs.helpers.arrayElement(['cash', 'transfer', 'card', 'mercadopago'] as const);
  const isPast = start.getTime() < now.getTime();

  if (status === 'pending' || status === 'cancelled' || status === 'no_show') {
    return { status: 'unpaid', entries: [] };
  }

  if (status === 'completed') {
    if (roll < 0.75) {
      return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
    }
    if (roll < 0.90) {
      const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
      return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
    }
    if (roll < 0.98) {
      return { status: 'unpaid', entries: [] };
    }
    // refunded — insert payment + matching refund
    return {
      status: 'refunded',
      entries: [
        { amount: totalPrice, entryType: 'payment', method },
        { amount: totalPrice, entryType: 'refund', method },
      ],
    };
  }

  // status === 'confirmed'
  if (isPast) {
    if (roll < 0.60) return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
    if (roll < 0.80) {
      const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
      return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
    }
    return { status: 'unpaid', entries: [] };
  }
  // confirmed future
  if (roll < 0.30) return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
  if (roll < 0.45) {
    const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
    return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
  }
  return { status: 'unpaid', entries: [] };
}

/**
 * 40% chance the booking has add-ons. Pick 1-2 random add-ons from
 * the resource's catalog. Returns priced line items ready to insert.
 */
export function pickAddOns(
  resource: SeededResource,
  durationHours: number,
): Array<{ addOnId: string; price: number }> {
  if (resource.addOns.length === 0) return [];
  const chance = fakerEs.number.float({ min: 0, max: 1 });
  if (chance > 0.4) return [];

  const pickCount = Math.min(
    resource.addOns.length,
    fakerEs.number.int({ min: 1, max: 2 }),
  );
  const picks = fakerEs.helpers.arrayElements(resource.addOns, pickCount);
  return picks.map((a: SeededAddOn) => ({
    addOnId: a.id,
    price: a.pricingMode === 'hourly' ? a.unitPrice * durationHours : a.unitPrice,
  }));
}

// Export types downstream callers need
export type { BookingStatus, PaymentStatus, PaymentPlan, SlotCandidate, ExistingSlot };
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/generators/bookings.ts
git commit -m "feat(seed): add pure booking decision helpers"
```

---

## Task 13: Booking generator — DB functions + orchestration

**Files:**
- Modify: `supabase/seed/generators/bookings.ts`

- [ ] **Step 1: Extend imports for DB functions and orchestration**

At the top of `supabase/seed/generators/bookings.ts`, add these imports below the existing ones:

```ts
import type { Sql } from '../lib/db';
// Extend the existing `import type { ... } from '../lib/types'` block
// to also import BookingOptions:
//
//   import type {
//     BookingOptions,   // <-- add
//     SeededAddOn,
//     SeededResource,
//     SeededTenant,
//   } from '../lib/types';
```

- [ ] **Step 2: Append DB functions and orchestration**

Append to the bottom of `supabase/seed/generators/bookings.ts`:

```ts
// ------------------------------------------------------------------
// DB functions — dumb, predictable inserts.
// ------------------------------------------------------------------

interface BookingRowData {
  resourceId: string;
  locationId: string;
  bookerId: string;
  start: Date;
  end: Date;
  durationHours: number;
  totalPrice: number;
  status: BookingStatus;
  notes: string | null;
}

async function insertBooking(sql: Sql, data: BookingRowData): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into public.bookings (
      resource_id, location_id, booker_id,
      start_time, end_time, duration_hours,
      total_price, status, notes
    ) values (
      ${data.resourceId}, ${data.locationId}, ${data.bookerId},
      ${data.start.toISOString()}, ${data.end.toISOString()}, ${data.durationHours},
      ${data.totalPrice}, ${data.status}, ${data.notes}
    )
    returning id
  `;
  return row.id;
}

async function insertBookingAddOns(
  sql: Sql,
  bookingId: string,
  picks: Array<{ addOnId: string; price: number }>,
): Promise<void> {
  if (picks.length === 0) return;
  await sql`
    insert into public.booking_add_ons ${sql(
      picks.map((p) => ({ booking_id: bookingId, add_on_service_id: p.addOnId, price: p.price })),
      'booking_id',
      'add_on_service_id',
      'price',
    )}
  `;
}

async function insertPayments(
  sql: Sql,
  bookingId: string,
  plan: PaymentPlan,
): Promise<void> {
  if (plan.entries.length === 0) return;
  await sql`
    insert into public.booking_payments ${sql(
      plan.entries.map((e) => ({
        booking_id: bookingId,
        amount: e.amount,
        entry_type: e.entryType,
        method: e.method,
      })),
      'booking_id',
      'amount',
      'entry_type',
      'method',
    )}
  `;
}

// ------------------------------------------------------------------
// Orchestrator: seeds bookers, then a batch of bookings with realistic
// status, payment, and add-on distributions. Collision detection is
// in-memory.
// ------------------------------------------------------------------

/**
 * Top-level booking generator. Creates ~target bookings across the
 * tenant's resources over `windowDays`. Actual count may be lower if
 * collisions exhaust our slot-picking attempts.
 *
 * `bookerIds` is passed in (not created here) so multiple tenants can
 * share the same booker pool where that makes sense. For thin tenants
 * the caller passes a small per-tenant pool.
 */
export async function seedBookingsForTenant(
  sql: Sql,
  tenant: SeededTenant,
  bookerIds: string[],
  opts: BookingOptions,
): Promise<{ created: number; skipped: number }> {
  if (bookerIds.length === 0) {
    throw new Error(`[seed] no bookers supplied for tenant ${tenant.slug}`);
  }
  if (tenant.resources.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const now = new Date();
  const existing: ExistingSlot[] = [];
  let created = 0;
  let skipped = 0;

  // We attempt up to target * 2 picks so we don't give up too early
  // when collisions happen on the hotter resources.
  const maxAttempts = opts.target * 2;
  for (let i = 0; i < maxAttempts && created < opts.target; i++) {
    const slot = pickSlot(tenant, opts.windowDays, now, existing);
    if (!slot) {
      skipped++;
      continue;
    }

    const resource = tenant.resources.find((r) => r.id === slot.resourceId);
    if (!resource) {
      skipped++;
      continue;
    }

    const addOns = pickAddOns(resource, slot.durationHours);
    const addOnTotal = addOns.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = resource.hourlyRate * slot.durationHours + addOnTotal;

    const status = assignStatus(slot.start, now);
    const paymentPlan = assignPaymentState(status, totalPrice, slot.start, now);

    const bookerId = fakerEs.helpers.arrayElement(bookerIds);
    const notes =
      fakerEs.number.float({ min: 0, max: 1 }) < 0.15
        ? fakerEs.lorem.sentence({ min: 4, max: 10 })
        : null;

    const bookingId = await insertBooking(sql, {
      resourceId: slot.resourceId,
      locationId: slot.locationId,
      bookerId,
      start: slot.start,
      end: slot.end,
      durationHours: slot.durationHours,
      totalPrice,
      status,
      notes,
    });

    await insertBookingAddOns(sql, bookingId, addOns);
    await insertPayments(sql, bookingId, paymentPlan);

    existing.push({
      resourceId: slot.resourceId,
      start: slot.start.getTime(),
      end: slot.end.getTime(),
    });
    created++;
  }

  return { created, skipped };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/generators/bookings.ts
git commit -m "feat(seed): add booking DB inserts + orchestration"
```

---

## Task 14: Entry point — wire everything together

**Files:**
- Create: `supabase/seed/index.ts`
- Delete: `supabase/seed.sql`

- [ ] **Step 1: Create the orchestrator**

Write `supabase/seed/index.ts` with:

```ts
import { createSqlClient } from './lib/db';
import { ensureDemoAuthUser, createThinTenantOwner } from './lib/admin';
import { seedPlans } from './generators/plans';
import { seedDemoTenant, seedThinTenants } from './generators/tenants';
import { seedBookers } from './generators/bookers';
import { seedBookingsForTenant } from './generators/bookings';
import { PLAN_SLUGS } from './lib/ids';

async function main() {
  const t0 = Date.now();
  console.log('[seed] starting…');

  // 1. Auth users — outside the transaction because the admin API
  //    doesn't share our pg connection. Idempotent for the demo user,
  //    assumes an empty auth.users table for thin tenants.
  await ensureDemoAuthUser();
  const thinOwnerIds = await Promise.all(
    PLAN_SLUGS.map((_, i) => createThinTenantOwner(i + 1)),
  );
  console.log(`[seed] auth users ready (1 demo + ${thinOwnerIds.length} thin)`);

  // 2. Main body: one transaction for everything else.
  const sql = createSqlClient();
  try {
    await sql.begin(async (tx) => {
      const planIdBySlug = await seedPlans(tx);
      console.log(`[seed] plans inserted: ${Object.keys(planIdBySlug).join(', ')}`);

      const demoTenant = await seedDemoTenant(tx, planIdBySlug);
      console.log(`[seed] demo tenant ready: ${demoTenant.slug}`);

      const thinTenants = await seedThinTenants(tx, planIdBySlug, thinOwnerIds);
      console.log(`[seed] thin tenants ready: ${thinTenants.map((t) => t.slug).join(', ')}`);

      // Shared booker pool for the demo tenant (higher variety).
      const demoBookers = await seedBookers(tx, 80);
      console.log(`[seed] demo bookers: ${demoBookers.length}`);

      const demoResult = await seedBookingsForTenant(tx, demoTenant, demoBookers, {
        windowDays: 90,
        target: 200,
      });
      console.log(
        `[seed] demo bookings: ${demoResult.created} created, ${demoResult.skipped} skipped`,
      );

      for (const tenant of thinTenants) {
        const bookers = await seedBookers(tx, 15);
        const result = await seedBookingsForTenant(tx, tenant, bookers, {
          windowDays: 30,
          target: 10,
        });
        console.log(
          `[seed] ${tenant.slug} bookings: ${result.created} created, ${result.skipped} skipped`,
        );
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[seed] done in ${elapsed}s`);
}

main().catch((err) => {
  console.error('[seed] FAILED');
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Delete the old SQL seed**

Run:
```bash
rm supabase/seed.sql
```

- [ ] **Step 4: Run the seed end-to-end**

Run:
```bash
npm run db:reset
```

Expected output (rough):
```
Resetting local database...
...
[seed] starting…
[seed] auth users ready (1 demo + 3 thin)
[seed] plans inserted: starter, pro, enterprise
[seed] demo tenant ready: estudio-sonico
[seed] thin tenants ready: estudio-<…>, sala-<…>, ciclorama-<…>
[seed] demo bookers: 80
[seed] demo bookings: 200 created, N skipped
[seed] estudio-<…> bookings: 10 created, N skipped
[seed] sala-<…> bookings: 10 created, N skipped
[seed] ciclorama-<…> bookings: 10 created, N skipped
[seed] done in <5s
```

Expected: total runtime under 5 seconds, demo creates 200 bookings (or very close), each thin tenant creates 10.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed/index.ts
git rm supabase/seed.sql
git commit -m "feat(seed): wire up entry point and delete seed.sql"
```

---

## Task 15: Manual verification checklist + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (Development Commands section)

- [ ] **Step 1: Run manual verification**

With the dev server running (`npm run dev`), verify each of these:

- [ ] Log in at `/login` with `demo@bukarrum.test` / `demo-password-123`
- [ ] Dashboard loads at `/dashboard/estudio-sonico`
- [ ] Calendar week view shows bookings in the current and adjacent weeks
- [ ] Calendar shows bookings in past weeks (navigate back)
- [ ] Bookings list page shows ~200 rows across all statuses
- [ ] At least one booking with status `completed`, `cancelled`, `no_show`, `pending`, `confirmed` is visible
- [ ] Analytics charts (if the tenant has analytics access) render with data — or the upgrade CTA shows (Pro plan doesn't have analytics)
- [ ] "Top customers" surface shows multiple bookers
- [ ] Payments panel on at least one booking shows a mix of paid / partial / refunded across the list
- [ ] Log out, log in as `owner+1@bukarrum.test` (same password), verify the dashboard shows a DIFFERENT tenant with only its own bookings (RLS check)
- [ ] `/[tenantSlug]` public booking page loads for `estudio-sonico` and for each thin tenant

If any step fails, fix the underlying bug before proceeding.

- [ ] **Step 2: Update CLAUDE.md development commands**

Open `CLAUDE.md` and find the `## Development Commands` section. Replace the `npx supabase db seed` line and add the new commands. Before:

```bash
npx supabase start         # Start local Supabase (Docker required)
npx supabase db reset      # Reset local DB with migrations
npx supabase db seed       # Seed local DB with test data
```

After:

```bash
npx supabase start         # Start local Supabase (Docker required)
npm run db:reset           # Reset + seed with faker (canonical dev reset)
npm run db:seed            # Seed only (assumes empty DB; prefer db:reset)
```

Also update the description of seed data in CLAUDE.md if it references `supabase/seed.sql`. Search for `seed.sql` with Grep before editing.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document npm run db:reset as canonical dev reset"
```

- [ ] **Step 4: Final smoke run**

Run `npm run db:reset` one more time from a clean state to confirm reproducibility, then log in as the demo user once more.

Expected: identical booking count to the previous run (because faker seed is deterministic).

---

## Summary

15 tasks, each producing a small, focused commit:

1. Add deps + npm scripts
2. Disable SQL seeder
3. DEMO constants
4. Postgres client + localhost guard
5. Seeded faker
6. Service-role admin + auth helpers
7. Shared types
8. Plans generator
9. Demo tenant generator
10. Thin tenants generator
11. Bookers generator
12. Booking pure helpers
13. Booking DB + orchestration
14. Entry point + delete seed.sql + end-to-end run
15. Manual verification + CLAUDE.md update

After Task 14 the seed is functionally complete and the <5s target is validated; Task 15 is the sign-off checklist and docs update.
