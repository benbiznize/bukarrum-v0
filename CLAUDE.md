# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bukarrum** is a Chilean B2B2C multi-tenant SaaS MVP for booking physical creative resources — DJ rehearsal rooms, music production studios, cycloramas, podcasting rooms — hired by the hour. It also supports equipment rental and add-on services (e.g., sound engineer).

Two user types:
- **Tenants** — Studio businesses that manage locations, resources, and bookings
- **Bookers** — End customers who book resources through the tenant's public page

**One business = one tenant = one membership.** A tenant cannot represent multiple businesses.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database / Auth / Storage**: Supabase (PostgreSQL with RLS, Supabase Auth with Google sign-in, Supabase Storage)
- **UI**: shadcn/ui + Tailwind CSS + Radix UI + Base UI (`@base-ui/react`)
- **Payments**: MercadoPago (tenant subscription billing)
- **Email**: Resend (transactional emails)
- **Hosting**: Vercel (with native GitHub, Supabase, and Resend integrations via Vercel Marketplace)
- **i18n**: Spanish-first with scaffolding for English

## Development Commands

```bash
npm run dev                # Start Next.js dev server
npm run build              # Production build
npm run lint               # ESLint
npm run type-check         # TypeScript type checking
npm run test:e2e           # Playwright e2e tests (tests/ at repo root)
npm run test:e2e:ui        # Playwright interactive UI mode
npx supabase start         # Start local Supabase (Docker required)
npx supabase db reset      # Reset local DB with migrations
npx supabase db seed       # Seed local DB with test data
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts  # Regenerate DB types
```

## Architecture

### Route Structure

```
src/
├── app/
│   ├── (marketing)/              # Landing, pricing, login — public
│   ├── (dashboard)/              # Tenant admin panel — auth required
│   │   └── dashboard/            # URL prefix: /dashboard/...
│   │       └── [tenantSlug]/     # Scoped to tenant
│   │           └── [locationSlug]/ # Scoped to location
│   ├── (booking)/                # Public booking pages
│   │   └── [tenantSlug]/         # Single-page booking flow
│   └── api/                      # Webhooks (MercadoPago IPN, etc.)
├── components/
│   ├── ui/                       # shadcn/ui components
│   └── ...                       # Feature components
├── lib/
│   ├── supabase/                 # Four client variants (see below) + generated types
│   ├── mercadopago/              # Payment SDK helpers
│   ├── resend/                   # Email templates and helpers
│   └── types/                    # Shared TypeScript types (e.g., plan-features.ts)
├── proxy.ts                      # Next.js 16 proxy (replaces middleware.ts)
└── hooks/                        # Client-side React hooks
```

### Multi-Tenancy

- Shared PostgreSQL database with Row Level Security (RLS)
- Every tenant-owned table has a `tenant_id` column; location-scoped tables use `location_id` (chains to `tenant_id`)
- RLS policies enforce tenant isolation at the database level
- Supabase Auth handles both tenant users and booker sessions
- URL structure: `/dashboard/[tenantSlug]/[locationSlug]` for admin; `/[tenantSlug]` for public booking
- Proxy at `src/proxy.ts` (Next.js 16 replaces `middleware.ts`) — handles auth gates, onboarding funnel redirects, and locale detection (cookie → `Accept-Language` → `es`)

### Data Patterns

- **Reads**: Server Components fetch directly from Supabase (no API layer needed)
- **Mutations**: Server Actions **colocated** as `actions.ts` next to each route (e.g., `src/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions.ts`). There is no central `src/actions/` directory.
- **Webhooks**: Route Handlers in `src/app/api/`
- **Client interactivity**: Pass data from Server Components to Client Components as serializable props (never pass Date objects, functions, or class instances across the boundary)

### Supabase Client Variants

Four clients in `src/lib/supabase/`, each for a specific context. Pick the right one:

| File | Use in | Auth | Notes |
|------|--------|------|-------|
| `client.ts` | Client Components | User session via browser cookies | `createBrowserClient` |
| `server.ts` | Server Components & Server Actions | User session via `next/headers` cookies | **Cannot** be used inside `"use cache"` |
| `public.ts` | `"use cache"` / `unstable_cache` functions | Anonymous (RLS public policies) | Cookie-less; required because `next/headers` is unavailable in cached reads |
| `service.ts` | Webhooks, background jobs, admin tasks | `SUPABASE_SERVICE_ROLE_KEY` — **bypasses RLS** | Never import into client code |

### Caching & Concurrency

- **Public booking page reads** use `unstable_cache` + per-tenant `revalidateTag("tenant:<id>")` (see `src/lib/booking/queries.ts`). Cached functions must use `createPublicClient` — not `server.ts` — because `next/headers` is unavailable inside `"use cache"`.
- **Booking mutations** go through Postgres RPCs (`supabase.rpc("book_resource", ...)` etc.) for atomic conflict prevention and server-side price validation. Don't reimplement booking logic in app code — extend the RPC in a migration instead.
- **Rate limiting** via Upstash Redis (`src/lib/rate-limit.ts`). Gracefully no-ops when `UPSTASH_REDIS_REST_*` env vars are missing, so local dev works without setup. Currently covers booking creation and contact form.

## Domain Model

**Entity hierarchy**: Tenant → Resources (tenant-scoped) ↔ Locations (many-to-many via `resource_locations`)

| Table | Description |
|-------|-------------|
| `tenants` | Studio businesses. One business = one tenant = one membership. |
| `locations` | Physical stores/branches (name, address, timezone, tenant_id). Count gated by subscription tier. |
| `resources` | Bookable rooms/equipment (name, type, hourly_rate, tenant_id). Tenant-scoped, assignable to multiple locations. |
| `resource_locations` | Junction table: many-to-many between resources and locations. |
| `availability` | Time slots when a resource is available for booking. |
| `bookings` | Reservations (resource_id, location_id, booker_id, start_time, end_time, status). |
| `bookers` | End customers who make bookings. |
| `plans` | Subscription plan definitions (name, slug, price_monthly, price_annual, features JSONB). |
| `subscriptions` | Tenant subscription state (plan_id, status, MercadoPago ref). Links tenant to active plan. |
| `add_on_services` | Optional services attachable to bookings (e.g., sound engineer). |

## Public Booking Flow

The tenant's public booking page (`/[tenantSlug]`) is a single-page progressive flow:

1. **Select location** — Choose from tenant's available locations
2. **Select resource** — Filtered by chosen location
3. **Select date** — Calendar showing only dates with availability for chosen resource
4. **Select time** — Available time slots on chosen date
5. **Select duration** — How many hours to book
6. **Contact details & book** — Booker info → creates booking with `pending` status

Implemented as client-side state transitions (not route changes) for conversion optimization.

## Payment Flows (MVP)

**Flow 1 — Tenant subscriptions (revenue):** 3-tier pricing (monthly/annual with discount). MercadoPago subscription API. Webhook-driven status updates in `src/app/api/`.

**Flow 2 — Booker payments (simplified):** Booker creates reservation (`pending` status). Tenant confirms manually after charging offline (`confirmed` status). No online payment integration for bookers in MVP.

## Feature Gating by Subscription Tier

**Where limits are defined:** The `plans` table has a JSONB `features` column:
```json
{ "locations": 3, "resources_per_location": 10, "bookings_per_month": 100, "add_ons": true, "analytics": false }
```

**How it's enforced (two layers):**
1. **Server-side (authoritative):** `checkPlanLimit()` utility called in Server Actions before mutations. Loads `subscriptions → plan_id → plans.features`. Returns error if limit exceeded.
2. **UI-level (cosmetic):** Dashboard components read plan features to show/hide capabilities. Not the enforcement layer.

**Resolution chain:** `tenant → subscriptions.plan_id → plans.features`

A typed interface in `src/lib/types/plan-features.ts` defines the JSONB shape for type safety across the app.

## Key Conventions

- Supabase types are auto-generated from the schema — never hand-write database types
- All Supabase queries use the typed client from `src/lib/supabase/`
- Spanish UI strings managed via i18n dictionaries — never hardcode user-facing strings
- Environment variables: `.env.local` for local dev, `vercel env` for production
- **Base UI gotchas**: `<SelectValue />` renders the raw `value` by default — always pass a children render function to display the label. `<Button render={<Link/>}>` requires `nativeButton={false}` to avoid nested-button warnings.
