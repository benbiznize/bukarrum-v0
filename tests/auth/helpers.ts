import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Supabase Admin client for programmatic test user management.
 * Uses the service role key to bypass RLS and email verification.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Creates a confirmed test user via Supabase Admin API.
 * Skips email verification — ready to log in immediately.
 */
export async function createTestUser(
  email = `test-${Date.now()}@example.com`,
  password = "test-password-123"
): Promise<TestUser> {
  // Retry up to 3 times — local Supabase can hit transient DB errors under parallel load
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (!error) return { id: data.user.id, email, password };
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  throw new Error(`Failed to create test user after 3 attempts`);
}

/**
 * Deletes a test user and all their data (tenant, locations, etc.).
 * Call in afterEach/afterAll to keep the test database clean.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete tenant data first (cascades to locations, resources, etc.)
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (tenant) {
    await supabaseAdmin.from("subscriptions").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("resource_locations").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("resources").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("locations").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
  }

  await supabaseAdmin.auth.admin.deleteUser(userId);
}

/**
 * Logs in a test user through the UI by filling the login form.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
}

// ---------------------------------------------------------------------------
// Mailpit helpers — intercept emails sent by local Supabase
// ---------------------------------------------------------------------------

const MAILPIT_URL = process.env.MAILPIT_URL || "http://127.0.0.1:54324";

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Snippet: string;
  Created: string;
}

/**
 * Waits for an email to arrive in Mailpit for the given recipient.
 * Polls every 500ms for up to `timeoutMs` (default 10s).
 * Only considers emails created after `afterTimestamp` to avoid
 * picking up stale messages from parallel tests.
 */
export async function waitForEmail(
  toAddress: string,
  subjectContains: string,
  { timeoutMs = 10000, after }: { timeoutMs?: number; after?: Date } = {}
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  const afterIso = after?.toISOString();

  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(toAddress)}`
    );
    const data = await res.json();
    const match = data.messages?.find(
      (m: MailpitMessage) =>
        m.Subject.includes(subjectContains) &&
        (!afterIso || m.Created > afterIso)
    );
    if (match) return match;
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(
    `No email with subject "${subjectContains}" for ${toAddress} within ${timeoutMs}ms`
  );
}

/**
 * Fetches the full email body and extracts the 6-digit OTP code.
 * Supabase emails include "enter the code: XXXXXX" in the text body.
 */
export async function getOtpFromEmail(messageId: string): Promise<string> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const data = await res.json();
  const match = data.Text?.match(/enter the code:\s*(\d{6})/);
  if (!match) throw new Error(`No OTP code found in email ${messageId}`);
  return match[1];
}