import { test, expect } from "@playwright/test";

test.describe("Protected routes", () => {
  test("redirects unauthenticated user from /dashboard to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("redirects unauthenticated user from /onboarding to /login", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("redirects unauthenticated user from /dashboard/any-slug to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/some-tenant/some-location");

    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("login page is accessible without authentication", async ({
    page,
  }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/login");
  });

  test("signup page is accessible without authentication", async ({
    page,
  }) => {
    const response = await page.goto("/signup");

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/signup");
  });
});
