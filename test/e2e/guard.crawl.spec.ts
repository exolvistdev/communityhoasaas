import { test, expect } from "@playwright/test";
import { inspectPage } from "./crawl";
import { GUARD_ROUTES } from "./routes";
import { authFile } from "./accounts";

test.use({ storageState: authFile("guard") });

for (const path of GUARD_ROUTES) {
  test(`guard: ${path} loads cleanly`, async ({ page }) => {
    await inspectPage(page, path);
  });
}

test("guard: camera permission is actually granted (next.config.mjs header order)", async ({
  page,
}) => {
  // The global Permissions-Policy denies camera everywhere (next.config.mjs);
  // a route-specific block re-grants it on /guard/* for GuardScanner.tsx's
  // QR scanner. Next.js applies last-matching-source-wins per header key —
  // this only works if that block stays ordered after the global one, which
  // nothing but this test enforces.
  const res = await page.goto("/guard");
  const policy = res?.headers()["permissions-policy"] ?? "";
  expect(policy).toContain("camera=(self)");
});
