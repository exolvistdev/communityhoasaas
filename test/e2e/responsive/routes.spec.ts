import { test } from "@playwright/test";
import { inspectResponsive } from "./inspect";
import {
  ADMIN_ROUTES,
  REPORT_ROUTES,
  PORTAL_ROUTES,
  GUARD_ROUTES,
  PLATFORM_ROUTES,
} from "../routes";
import { authFile } from "../accounts";

// Runs under every device project in RESPONSIVE_PROJECTS (playwright.config.ts)
// — reuses the same route inventories and storageState as the desktop crawl,
// just at a phone/tablet/foldable viewport instead of desktop.

test.describe("reports (detailed — the reported problem area)", () => {
  test.use({ storageState: authFile("admin") });
  for (const path of REPORT_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await inspectResponsive(page, path, { detailed: true });
    });
  }
});

test.describe("admin (overflow check only)", () => {
  test.use({ storageState: authFile("admin") });
  for (const path of ADMIN_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await inspectResponsive(page, path);
    });
  }
});

test.describe("portal (overflow check only)", () => {
  test.use({ storageState: authFile("homeowner") });
  for (const path of PORTAL_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await inspectResponsive(page, path);
    });
  }
});

test.describe("guard (overflow check only)", () => {
  test.use({ storageState: authFile("guard") });
  for (const path of GUARD_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await inspectResponsive(page, path);
    });
  }
});

test.describe("platform (overflow check only)", () => {
  test.use({ storageState: authFile("platform") });
  for (const path of PLATFORM_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await inspectResponsive(page, path);
    });
  }
});
