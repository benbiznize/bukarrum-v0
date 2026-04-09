import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginViaUI } from "./helpers";

test.describe("Logout flow", () => {
  test("logs out and redirects to login page", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      await loginViaUI(page, testUser.email, testUser.password);
      await page.waitForURL("**/onboarding", { timeout: 10000 });

      // Find and click sign out (the onboarding page has a sign-out link)
      const signOutButton = page.locator("text=Cerrar sesión").or(
        page.locator("text=Sign out")
      );
      await signOutButton.click();

      // Should redirect to login
      await page.waitForURL("**/login", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    } finally {
      await deleteTestUser(testUser.id);
    }
  });

  test("cannot access protected routes after logout", async ({ page }) => {
    const testUser = await createTestUser();

    try {
      await loginViaUI(page, testUser.email, testUser.password);
      await page.waitForURL("**/onboarding", { timeout: 10000 });

      // Log out
      const signOutButton = page.locator("text=Cerrar sesión").or(
        page.locator("text=Sign out")
      );
      await signOutButton.click();
      await page.waitForURL("**/login", { timeout: 10000 });

      // Try accessing protected route
      await page.goto("/dashboard");
      await page.waitForURL("**/login", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    } finally {
      await deleteTestUser(testUser.id);
    }
  });
});
