import { test, expect } from "@playwright/test";
import { authFile } from "./accounts";

test.use({ storageState: authFile("homeowner") });

test("portal: can submit a maintenance request end to end", async ({ page }) => {
  await page.goto("/portal/maintenance/new");
  await page.locator('select[name="category"]').selectOption({ index: 1 });
  await page.locator('input[name="title"]').fill("E2E test: kitchen sink leaking");
  await page
    .locator('textarea[name="description"]')
    .fill("Reported via the automated inspection suite.");

  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page).toHaveURL(/\/portal\/maintenance\/(?!new)[a-z0-9-]+$/i, {
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(/kitchen sink leaking/i);
});

test("portal: can post a marketplace listing end to end", async ({ page }) => {
  await page.goto("/portal/market/new");
  await page.locator('input[name="title"]').fill("E2E test listing — patio chair");
  await page.locator('input[name="price"]').fill("500");
  await page
    .locator('textarea[name="description"]')
    .fill("Posted via the automated inspection suite.");

  await page.getByRole("button", { name: "Post listing" }).click();

  await expect(page).toHaveURL(/\/portal\/market\/(?!new)[a-z0-9-]+$/i, {
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(/patio chair/i);
});

test("portal: can cast a ballot, if a vote is open", async ({ page }) => {
  await page.goto("/portal/votes");
  const choiceButtons = page.locator("form button, div button").filter({
    hasText: /^(In favour|Against|Abstain)$/i,
  });
  const count = await choiceButtons.count();
  test.skip(count === 0, "no open resolution vote in the current seed");

  await choiceButtons.first().click();
  await expect(page.locator("body")).toContainText(/ballot recorded/i, {
    timeout: 10_000,
  });
});
