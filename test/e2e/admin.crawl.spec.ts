import { test } from "@playwright/test";
import { inspectPage } from "./crawl";
import { ADMIN_ROUTES, REPORT_ROUTES } from "./routes";
import { authFile } from "./accounts";

test.use({ storageState: authFile("admin") });

for (const path of [...ADMIN_ROUTES, ...REPORT_ROUTES]) {
  test(`admin: ${path} loads cleanly`, async ({ page }) => {
    await inspectPage(page, path);
  });
}
