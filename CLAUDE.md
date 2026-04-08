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
- **UI**: shadcn/ui + Tailwind CSS + Radix UI
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
│   ├── supabase/                 # Client, server, proxy helpers + generated types
│   ├── mercadopago/              # Payment SDK helpers
│   ├── resend/                   # Email templates and helpers
│   └── types/                    # Shared TypeScript types (e.g., plan-features.ts)
├── actions/                      # Server Actions (mutations)
└── hooks/                        # Client-side React hooks
```

### Multi-Tenancy

- Shared PostgreSQL database with Row Level Security (RLS)
- Every tenant-owned table has a `tenant_id` column; location-scoped tables use `location_id` (chains to `tenant_id`)
- RLS policies enforce tenant isolation at the database level
- Supabase Auth handles both tenant users and booker sessions
- URL structure: `/dashboard/[tenantSlug]/[locationSlug]` for admin; `/[tenantSlug]` for public booking
- Proxy (Next.js 16 `proxy.ts`) protects `(dashboard)` routes — redirects unauthenticated users

### Data Patterns

- **Reads**: Server Components fetch directly from Supabase (no API layer needed)
- **Mutations**: Server Actions in `src/actions/`
- **Webhooks**: Route Handlers in `src/app/api/`
- **Client interactivity**: Pass data from Server Components to Client Components as serializable props (never pass Date objects, functions, or class instances across the boundary)

## Domain Model

**Entity hierarchy**: Tenant → Locations → Resources → Bookings

| Table | Description |
|-------|-------------|
| `tenants` | Studio businesses. One business = one tenant = one membership. |
| `locations` | Physical stores/branches (name, address, timezone, tenant_id). Count gated by subscription tier. |
| `resources` | Bookable rooms/equipment within a location (name, type, hourly_rate, location_id). |
| `availability` | Time slots when a resource is available for booking. |
| `bookings` | Reservations (resource_id, booker_id, start_time, end_time, status). |
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
