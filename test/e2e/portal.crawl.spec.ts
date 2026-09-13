import { test } from "@playwright/test";
import { inspectPage } from "./crawl";
import { PORTAL_ROUTES } from "./routes";
import { authFile } from "./accounts";

test.use({ storageState: authFile("homeowner") });

for (const path of PORTAL_ROUTES) {
  test(`portal: ${path} loads cleanly`, async ({ page }) => {
    await inspectPage(page, path);
  });
}
