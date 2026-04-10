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
