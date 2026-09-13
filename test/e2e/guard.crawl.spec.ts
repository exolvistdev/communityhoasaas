import { test } from "@playwright/test";
import { inspectPage } from "./crawl";
import { GUARD_ROUTES } from "./routes";
import { authFile } from "./accounts";

test.use({ storageState: authFile("guard") });

for (const path of GUARD_ROUTES) {
  test(`guard: ${path} loads cleanly`, async ({ page }) => {
    await inspectPage(page, path);
  });
}
