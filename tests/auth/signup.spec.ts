import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./helpers";

let createdUserId: string | null = null;

test.afterEach(async () => {
  if (createdUserId) {
    await deleteTestUser(createdUserId);
    createdUserId = null;
  }
});

test.describe("Signup flow", () => {
  test("signs up with email/password and redirects to onboarding", async ({
    page,
  }) => {
    const testEmail = `signup-${Date.now()}@example.com`;
    const testPassword = "test-password-123";

    await page.goto("/signup");

    // Verify signup page renders
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Fill the form
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // Should redirect to onboarding after signup
    await page.waitForURL("**/onboarding", { timeout: 10000 });
    expect(page.url()).toContain("/onboarding");
  });

  test("shows error for duplicate email", async ({ page, browser }) => {
    // Create user via Admin API so we have a known existing email
    const existing = await createTestUser(`dup-${Date.now()}@example.com`);
    createdUserId = existing.id;

    // Try to sign up with the same email through UI
    await page.goto("/signup");
    await page.locator("#email").fill(existing.email);
    await page.locator("#password").fill("another-password-123");
    await page.locator('button[type="submit"]').click();

    // Should show an error (stays on signup page)
    await expect(
      page.locator(".text-destructive")
    ).toBeVisible({ timeout: 5000 });
  });

  test("signup page has link to login", async ({ page }) => {
    await page.goto("/signup");

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});
