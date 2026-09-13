import { test, expect } from "@playwright/test";
import { authFile } from "./accounts";

test.use({ storageState: authFile("admin") });

test("admin: can log a violation end to end", async ({ page }) => {
  await page.goto("/violations");
  await page.getByRole("button", { name: "Log a violation" }).click();

  await page.locator('select[name="propertyId"]').selectOption({ index: 1 });
  await page.locator('select[name="category"]').selectOption({ index: 1 });
  await page.locator('input[name="occurredAt"]').fill("2026-09-01");
  await page
    .locator('textarea[name="description"]')
    .fill("E2E test: loud noise complaint after hours.");

  await page.getByRole("button", { name: "Log violation" }).click();

  // logViolation() redirects to /violations/[id] on success.
  await expect(page).toHaveURL(/\/violations\/[a-z0-9-]+$/i, { timeout: 10_000 });
  await expect(page.locator("body")).toContainText(/loud noise complaint/i);
});

test("admin: can confirm a pending payment, if one exists", async ({ page }) => {
  await page.goto("/reconciliation");
  const confirmButtons = page.getByRole("button", { name: "Confirm" });
  const count = await confirmButtons.count();
  test.skip(count === 0, "no pending payment in the current seed to confirm");

  await confirmButtons.first().click();
  // The row leaves the pending list once confirmed (page re-renders via router.refresh()).
  await expect(confirmButtons).toHaveCount(count - 1, { timeout: 10_000 });
});

test("admin: can send a team invite", async ({ page }) => {
  // Unique per run — a fixed address would 409 ("already on the team") on
  // any re-run before the next `npm run db:seed` reset, and inviteMember()
  // creates a real Supabase Auth user + Prisma row (and, wherever
  // POSTMARK_SERVER_TOKEN is configured, sends a real email) so this test
  // should only be run against an environment without Postmark configured,
  // or accept that it sends one.
  const email = `e2e-invite-${Date.now()}@example.com`;

  await page.goto("/team");
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="fullName"]').fill("E2E Test Invitee");
  await page.locator('select[name="role"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Send invite" }).click();

  await expect(page.locator("body")).toContainText(email, { timeout: 10_000 });
});
