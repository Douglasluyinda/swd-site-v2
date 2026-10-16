// Browser (end-to-end) test coverage, layered on top of the Vitest unit/
// integration suite. These exercise real pages in a real browser — routing,
// auth redirects, form validation — things a unit test can't see.
//
// Deliberately NOT covered here: a full checkout submission. That would
// write a real order (and attempt a real Flutterwave charge) against
// whatever DATABASE_URL is configured, which in this project is the live
// Neon database — there's no separate throwaway test database yet. Until
// one exists, keep these tests to flows that don't mutate order/payment
// data: navigation, auth gating, and form validation errors.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the browser binary baked into the CI/dev image rather than
        // downloading a matching revision — avoids network access during
        // test runs and a version mismatch against @playwright/test's
        // pinned default revision.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
