import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  waitForEmail,
  getOtpFromEmail,
} from "./helpers";

test.describe("Magic link / OTP login", () => {
  test("sends OTP email and verifies code to log in", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      const before = new Date();

      await page.goto("/login");

      // Switch to magic link tab (second tab, value=1)
      await page.locator('[role="tab"]').nth(1).click();

      // Enter email and request OTP
      await page.locator("#otp-email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      // Wait for the OTP input to appear (indicates email was "sent")
      await expect(page.locator("#otp-code")).toBeVisible({ timeout: 10000 });

      // Grab the OTP from Mailpit
      const email = await waitForEmail(testUser.email, "Magic Link", {
        after: before,
      });
      const otp = await getOtpFromEmail(email.ID);
      expect(otp).toMatch(/^\d{6}$/);

      // Enter the OTP code
      await page.locator("#otp-code").fill(otp);
      await page.locator('button[type="submit"]').click();

      // Should redirect to dashboard/onboarding after verification
      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("shows error for invalid OTP code", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      const before = new Date();

      await page.goto("/login");

      // Switch to magic link tab
      await page.locator('[role="tab"]').nth(1).click();

      await page.locator("#otp-email").fill(testUser.email);
      await page.locator('button[type="submit"]').click();

      await expect(page.locator("#otp-code")).toBeVisible({ timeout: 10000 });

      // Enter a wrong code
      await page.locator("#otp-code").fill("000000");
      await page.locator('button[type="submit"]').click();

      // Should show error
      await expect(
        page.locator(".text-destructive")
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("OTP signup creates account and redirects to onboarding", async ({
    page,
  }) => {
    const testEmail = `otp-signup-${Date.now()}@example.com`;
    const before = new Date();

    await page.goto("/signup");

    // Switch to magic link tab
    await page.locator('[role="tab"]').nth(1).click();

    await page.locator("#otp-email").fill(testEmail);
    await page.locator('button[type="submit"]').click();

    // Wait for OTP input
    await expect(page.locator("#otp-code")).toBeVisible({ timeout: 10000 });

    // Get OTP from email
    const email = await waitForEmail(testEmail, "Magic Link", {
      after: before,
    });
    const otp = await getOtpFromEmail(email.ID);

    await page.locator("#otp-code").fill(otp);
    await page.locator('button[type="submit"]').click();

    // New user → should go to onboarding
    await page.waitForURL("**/onboarding", { timeout: 10000 });
    expect(page.url()).toContain("/onboarding");
  });
});
