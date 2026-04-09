import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  waitForEmail,
} from "./helpers";

const MAILPIT_URL = "http://127.0.0.1:54324";

/** Fetches the reset link from a Mailpit message */
async function getResetLink(messageId: string): Promise<string> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const msg = await res.json();
  const match = msg.HTML?.match(/href="([^"]*verify[^"]*)"/);
  if (!match) throw new Error("No reset link found in email");
  return match[1].replace(/&amp;/g, "&");
}

test.describe("Password reset flow", () => {
  test("sends reset email and shows confirmation", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      const before = new Date();

      await page.goto("/forgot-password");
      await page.locator("#email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      // Should show the "check your email" confirmation
      await expect(page.locator("strong").filter({ hasText: testUser.email }))
        .toBeVisible({ timeout: 5000 });

      // Verify the email was actually sent via Mailpit
      const email = await waitForEmail(testUser.email, "Reset Your Password", {
        after: before,
      });
      expect(email.Subject).toContain("Reset Your Password");
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("reset link navigates to reset-password page", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      const before = new Date();

      await page.goto("/forgot-password");
      await page.locator("#email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      const email = await waitForEmail(testUser.email, "Reset Your Password", {
        after: before,
      });
      const resetLink = await getResetLink(email.ID);

      // Follow the reset link — Supabase verify → callback → /reset-password
      await page.goto(resetLink);
      await page.waitForURL("**/reset-password", { timeout: 15000 });

      // Verify the reset form is visible
      await expect(page.locator("#password")).toBeVisible();
      await expect(page.locator("#confirm")).toBeVisible();
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("can set a new password and log in with it", async ({ page }) => {
    const testUser = await createTestUser();
    const newPassword = "new-secure-password-456";

    try {
      const before = new Date();

      await page.goto("/forgot-password");
      await page.locator("#email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      const email = await waitForEmail(testUser.email, "Reset Your Password", {
        after: before,
      });
      const resetLink = await getResetLink(email.ID);

      await page.goto(resetLink);
      await page.waitForURL("**/reset-password", { timeout: 15000 });

      // Fill in new password
      await page.locator("#password").fill(newPassword);
      await page.locator("#confirm").fill(newPassword);
      await page.locator('button[type="submit"]').click();

      // Should redirect to dashboard/onboarding after reset
      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });

      // Log out, then log in with the new password
      const signOutButton = page.locator("text=Cerrar sesión").or(
        page.locator("text=Sign out")
      );
      await signOutButton.click();
      await page.waitForURL("**/login", { timeout: 10000 });

      await page.locator("#email").fill(testUser.email);
      await page.locator("#password").fill(newPassword);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("shows error when passwords do not match", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      const before = new Date();

      await page.goto("/forgot-password");
      await page.locator("#email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      const email = await waitForEmail(testUser.email, "Reset Your Password", {
        after: before,
      });
      const resetLink = await getResetLink(email.ID);

      await page.goto(resetLink);
      await page.waitForURL("**/reset-password", { timeout: 15000 });

      // Enter mismatched passwords
      await page.locator("#password").fill("password-one-123");
      await page.locator("#confirm").fill("password-two-456");
      await page.locator('button[type="submit"]').click();

      // Should show mismatch error
      await expect(
        page.locator(".text-destructive")
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteTestUser(testUser.id);
    }
  });
});
