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

// Device/breakpoint matrix for test/e2e/responsive/ — chosen to bracket
// Tailwind's sm(640)/md(768)/lg(1024) breakpoints with real phone, tablet and
// foldable shapes. Playwright ships no foldable preset, so those two are
// custom viewports (approximate real Galaxy Z Fold5 dimensions).
const RESPONSIVE_PROJECTS = [
  { name: "mobile-se", use: devices["iPhone SE"] }, // small phone ~375×667
  { name: "mobile-android-small", use: devices["Galaxy S9+"] }, // narrow phone ~320×658
  { name: "mobile-standard", use: devices["iPhone 13"] }, // standard phone ~390×844
  { name: "mobile-android", use: devices["Pixel 7"] }, // standard Android ~412×915
  { name: "mobile-large", use: devices["iPhone 14 Pro Max"] }, // phablet ~430×932
  {
    name: "foldable-closed",
    use: { viewport: { width: 344, height: 882 } }, // Z Fold-style cover screen
  },
  {
    name: "foldable-open",
    use: { viewport: { width: 717, height: 512 } }, // Z Fold-style unfolded
  },
  { name: "tablet-portrait", use: devices["iPad Mini"] }, // 768×1024 — sits on the `md` boundary
  { name: "tablet-landscape", use: devices["iPad Pro 11 landscape"] }, // ~1194×834
];

export default defineConfig({
  testDir: "test/e2e",
  // Serial — concurrent logins from the same IP within a few seconds of each
  // other were observed to silently fail (no error shown, no redirect; see
  // the findings report). Root cause not chased down (likely the DB-backed
  // rate limiter's read-then-write racing under load, or something in the
  // Supabase SSR cookie path) — running one at a time sidesteps it reliably.
  // This only actually matters for the `setup` project (the only one that
  // calls login). Everything downstream — including the ~500-case device
  // matrix in test/e2e/responsive/ — only ever navigates with the storageState
  // `setup` already produced, so once `test/e2e/.auth/*.json` exist you can
  // safely go faster for iterative runs:
  //   npx playwright test --project=setup            # once, serially
  //   npx playwright test test/e2e/responsive/ --no-deps --workers=4
  // `--no-deps` skips re-running `setup` (and its logins) for that invocation.
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
      testIgnore: "responsive/**",
    },
    // One project per device in RESPONSIVE_PROJECTS, scoped to
    // test/e2e/responsive/ only — see test/e2e/responsive/routes.spec.ts.
    // Forced to chromium (only chromium is installed here) — the iPhone/iPad
    // device presets otherwise default to webkit; this is a CSS-layout
    // overflow check, not a cross-engine rendering test, so the viewport/UA
    // emulation matters far more than the actual engine underneath.
    ...RESPONSIVE_PROJECTS.map(({ name, use }) => ({
      name,
      use: { ...use, browserName: "chromium" as const },
      dependencies: ["setup"],
      testDir: "test/e2e/responsive",
    })),
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 5 * 60_000,
  },
});
