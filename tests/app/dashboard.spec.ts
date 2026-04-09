import { test, expect } from "@playwright/test";

/**
 * These tests run with a pre-authenticated session (storageState)
 * seeded by global.setup.ts. No login step needed.
 *
 * Seeded data: tenant "E2E Studio" (slug: e2e-studio)
 *   - 1 location: "E2E Location" (slug: e2e-location)
 *   - 1 resource: "E2E Room" (room, 10000 CLP/hr)
 */

test.describe("Dashboard", () => {
  test("loads the dashboard overview for seeded tenant", async ({ page }) => {
    await page.goto("/dashboard/e2e-studio");

    // Sidebar shows tenant name
    await expect(page.locator("text=E2E Studio")).toBeVisible();

    // Stat cards are rendered (scoped to main content area to avoid sidebar matches)
    const main = page.locator("main");
    await expect(main.getByText(/Ubicaciones|Locations/).first())
      .toBeVisible({ timeout: 5000 });
    await expect(main.getByText(/Recursos|Resources/).first())
      .toBeVisible({ timeout: 5000 });
  });

  test("sidebar shows seeded location", async ({ page }) => {
    await page.goto("/dashboard/e2e-studio");

    await expect(page.locator("text=E2E Location")).toBeVisible();
  });

  test("can navigate to bookings page", async ({ page }) => {
    await page.goto("/dashboard/e2e-studio");

    const bookingsLink = page.locator('a[href*="bookings"]');
    await bookingsLink.click();

    await page.waitForURL("**/bookings", { timeout: 5000 });
    expect(page.url()).toContain("/dashboard/e2e-studio/bookings");
  });

  test("can navigate to location detail", async ({ page }) => {
    await page.goto("/dashboard/e2e-studio");

    await page.locator("text=E2E Location").click();

    await page.waitForURL("**/e2e-location**", { timeout: 5000 });
    expect(page.url()).toContain("e2e-location");
  });
});
