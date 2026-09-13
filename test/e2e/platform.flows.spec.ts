import { test, expect } from "@playwright/test";
import { authFile } from "./accounts";

test.use({ storageState: authFile("platform") });

test("platform: can impersonate a user and stop impersonating", async ({ page }) => {
  await page.goto("/platform");
  const firstOrgLink = page.locator('a[href^="/platform/orgs/"]').first();
  await firstOrgLink.click();

  page.on("dialog", (d) => d.accept()); // ImpersonateButton's confirm()
  const impersonateButtons = page.getByRole("button", { name: "Impersonate" });
  const count = await impersonateButtons.count();
  test.skip(count === 0, "the first org has no users to impersonate");

  await impersonateButtons.first().click();

  // startImpersonation() redirects into the target user's own landing page.
  await expect(page).not.toHaveURL(/\/platform/, { timeout: 10_000 });
  await expect(page.getByText(/viewing as/i)).toBeVisible();

  await page.getByRole("button", { name: "Stop impersonating" }).click();
  await expect(page).toHaveURL(/\/platform/, { timeout: 10_000 });
});
