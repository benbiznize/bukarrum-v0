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
    insert into public.plans ${sql(rows)}
    returning id, slug
  `;

  const map: Record<string, string> = {};
  for (const row of inserted) map[row.slug] = row.id;
  return map;
}
