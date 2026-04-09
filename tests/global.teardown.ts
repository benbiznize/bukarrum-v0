import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Global teardown: deletes the seeded tenant user.
 * ON DELETE CASCADE handles all related data (tenant → locations → resources, etc.)
 */
teardown("delete seeded tenant user", async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("user_id")
    .eq("slug", "e2e-studio")
    .single();

  if (tenant) {
    await supabase.auth.admin.deleteUser(tenant.user_id);
  }
});
