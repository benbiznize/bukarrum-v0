import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginViaUI } from "./helpers";

test.describe("Login flow", () => {
  test("logs in with valid email/password and redirects to onboarding", async ({
    page,
  }) => {
    const testUser = await createTestUser();

    try {
      await loginViaUI(page, testUser.email, testUser.password);

      // New user with no tenant → proxy redirects to onboarding
      await page.waitForURL("**/onboarding", { timeout: 10000 });
      expect(page.url()).toContain("/onboarding");
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("shows error for invalid credentials", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      await page.goto("/login");
      await page.locator("#email").fill(testUser.email);
      await page.locator("#password").fill("wrong-password");
      await page.locator('button[type="submit"]').click();

      // Should show error message
      await expect(
        page.locator(".text-destructive")
      ).toBeVisible({ timeout: 5000 });

      // Should stay on login page
      expect(page.url()).toContain("/login");
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto("/login");

    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
  });

  test("login page has forgot password link", async ({ page }) => {
    await page.goto("/login");

    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });
});
