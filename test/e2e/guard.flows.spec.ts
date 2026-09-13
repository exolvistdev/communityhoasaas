import { test, expect } from "@playwright/test";
import { authFile } from "./accounts";

test.use({ storageState: authFile("guard") });

async function check(page: import("@playwright/test").Page, code: string) {
  await page.goto("/guard");
  // Not `getByLabel` — the "Visitor pass code" <label> isn't programmatically
  // associated with the <input> (no `for`/`id`, not wrapping it either); see
  // the a11y findings report ("label" rule).
  await page.getByPlaceholder("e.g. K7M4PQ2R").fill(code);
  await page.getByRole("button", { name: "Check" }).click();
}

test("guard: a valid pass reads as valid (or already used)", async ({ page }) => {
  // VALID123 is single-use — validating it marks it USED, so re-running this
  // suite without an intervening `npm run db:seed` will legitimately see
  // "Already used" on the second+ run. Both outcomes prove the check works;
  // only a wrong verdict (e.g. "Expired") would indicate a real bug.
  await check(page, "VALID123");
  await expect(page.locator("body")).toContainText(
    /valid — let them in|already used/i,
    { timeout: 10_000 }
  );
});

test("guard: an expired pass is rejected", async ({ page }) => {
  await check(page, "EXPIRED9");
  await expect(page.locator("body")).toContainText(/expired/i, { timeout: 10_000 });
});

test("guard: a revoked pass is rejected", async ({ page }) => {
  await check(page, "REVOKED7");
  await expect(page.locator("body")).toContainText(/revoked/i, { timeout: 10_000 });
});

test("guard: an unknown code is reported as not found", async ({ page }) => {
  await check(page, "NOPE0000");
  await expect(page.locator("body")).toContainText(/no matching pass/i, {
    timeout: 10_000,
  });
});
