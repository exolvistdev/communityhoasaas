import { test as setup, expect } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, authFile } from "./accounts";

// Logs in once per role through the real UI and saves the resulting session
// cookies, so every other spec can `test.use({ storageState: authFile(...) })`
// instead of re-logging-in for every test.

async function login(
  page: import("@playwright/test").Page,
  loginPath: string,
  email: string
) {
  await page.goto(loginPath);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
}

setup("authenticate as admin", async ({ page }) => {
  await login(page, "/login", ACCOUNTS.admin.email);
  await expect(page, `page text: ${await page.locator("body").innerText()}`)
    .toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.context().storageState({ path: authFile("admin") });
});

setup("authenticate as homeowner", async ({ page }) => {
  await login(page, "/login", ACCOUNTS.homeowner.email);
  await expect(page, `page text: ${await page.locator("body").innerText()}`)
    .toHaveURL(/\/portal$/, { timeout: 15_000 });
  await page.context().storageState({ path: authFile("homeowner") });
});

setup("authenticate as guard", async ({ page }) => {
  await login(page, "/login", ACCOUNTS.guard.email);
  await expect(page, `page text: ${await page.locator("body").innerText()}`)
    .toHaveURL(/\/guard$/, { timeout: 15_000 });
  await page.context().storageState({ path: authFile("guard") });
});

setup("authenticate as platform admin", async ({ page }) => {
  await login(page, "/platform/login", ACCOUNTS.platform.email);
  // anchored — /platform/login also matches an unanchored /\/platform/
  await expect(page, `page text: ${await page.locator("body").innerText()}`)
    .toHaveURL(/\/platform$/, { timeout: 15_000 });
  await page.context().storageState({ path: authFile("platform") });
});
