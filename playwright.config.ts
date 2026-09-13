import { defineConfig, devices } from "@playwright/test";

// End-to-end inspection/testing of the built application (admin app, resident
// portal, guard console, platform console) — deliberately excludes the
// marketing site. Separate from vitest (test/unit, test/integration) — this
// drives a real browser against a running server.
//
// Run:
//   npm run build && npm run start -- -p 4321   (once, in one terminal)
//   npm run test:e2e                            (repeatedly, in another)
// or just `npm run test:e2e` on its own — the webServer block below will
// build + start it for you if nothing is already listening on the port.
const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "test/e2e",
  // Serial — concurrent logins from the same IP within a few seconds of each
  // other were observed to silently fail (no error shown, no redirect; see
  // the findings report). Root cause not chased down (likely the DB-backed
  // rate limiter's read-then-write racing under load, or something in the
  // Supabase SSR cookie path) — running one at a time sidesteps it reliably.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
    // Read by scripts/summarize-e2e.mjs to call out skipped flow tests
    // (e.g. "no pending payment to confirm") loudly instead of them quietly
    // going green — a skip can mean a core flow went unexercised this run.
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 5 * 60_000,
  },
});
