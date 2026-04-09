import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_EMAIL = "e2e-tenant@bukarrum.test";
const TEST_PASSWORD = "e2e-test-password-123";
const AUTH_STATE_PATH = "tests/.auth/tenant.json";

/**
 * Global setup: creates a fully onboarded tenant user and saves the
 * browser session to disk. Tests that depend on the "setup" project
 * start already authenticated — no login step needed.
 */
setup("seed tenant user and save auth state", async ({ page }) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Clean up any leftover test user from a previous run
  const { data: existing } = await supabase
    .from("tenants")
    .select("id, user_id")
    .eq("slug", "e2e-studio")
    .single();

  if (existing) {
    await supabase.auth.admin.deleteUser(existing.user_id);
  }

  // 1. Create confirmed user
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  if (userError) throw new Error(`Setup: create user failed: ${userError.message}`);
  const userId = userData.user.id;

  // 2. Get the starter plan
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", "starter")
    .single();

  if (!plan) throw new Error("Setup: no starter plan found — run seed first");

  // 3. Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ user_id: userId, name: "E2E Studio", slug: "e2e-studio" })
    .select("id")
    .single();

  if (tenantError) throw new Error(`Setup: create tenant failed: ${tenantError.message}`);

  // 4. Create subscription
  await supabase
    .from("subscriptions")
    .insert({ tenant_id: tenant.id, plan_id: plan.id, status: "active" });

  // 5. Create location
  const { data: location } = await supabase
    .from("locations")
    .insert({
      tenant_id: tenant.id,
      name: "E2E Location",
      slug: "e2e-location",
      address: "Av. Test 123, Santiago",
      timezone: "America/Santiago",
    })
    .select("id")
    .single();

  // 6. Create resource
  const { data: resource } = await supabase
    .from("resources")
    .insert({
      tenant_id: tenant.id,
      name: "E2E Room",
      type: "room",
      hourly_rate: 10000,
      min_duration_hours: 1,
      max_duration_hours: 4,
    })
    .select("id")
    .single();

  // 7. Link resource to location
  await supabase
    .from("resource_locations")
    .insert({ resource_id: resource!.id, location_id: location!.id });

  // 8. Log in via browser and save session
  await page.goto("/login");
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Fully onboarded user → lands on dashboard
  await page.waitForURL("**/dashboard/**", { timeout: 15000 });

  // Save browser state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
