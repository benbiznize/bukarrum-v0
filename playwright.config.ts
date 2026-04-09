import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // 1. Setup: seed a fully onboarded tenant user and save session
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // 2. Auth tests: test login/signup/logout flows (no saved session)
    {
      name: "auth",
      testMatch: /auth\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 3. Authenticated tests: start with a pre-authenticated session
    {
      name: "authenticated",
      testMatch: /app\/.+\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/tenant.json",
      },
    },
    // 4. Teardown: clean up seeded tenant user
    {
      name: "teardown",
      testMatch: /global\.teardown\.ts/,
      dependencies: ["authenticated"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
