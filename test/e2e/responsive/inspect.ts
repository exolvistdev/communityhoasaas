import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { assertPageHealthy, slug } from "../health";

const OUT_DIR = "test-results/responsive";
mkdirSync(OUT_DIR, { recursive: true });

/**
 * Visits `path` under whatever device viewport the current project defines
 * (see the RESPONSIVE_PROJECTS matrix in playwright.config.ts). Fails the
 * test only on genuine breakage — see `assertPageHealthy` in ../health, the
 * same bar as test/e2e/crawl.ts.
 *
 * Horizontal overflow (`scrollWidth > clientWidth` — content wider than the
 * viewport, the classic "renders differently on smaller screens" symptom)
 * does NOT fail the test here. It's written to
 * test-results/responsive/<project>__<slug>.json and rolled up afterward by
 * scripts/summarize-e2e.mjs, same reasoning as the a11y scan: one root cause
 * (e.g. an unwrapped report table) can hit dozens of page/device
 * combinations, and that should read as one finding, not dozens of red tests.
 *
 * `detailed: true` (used for the Reports routes — the specifically-reported
 * problem area) also saves a full-page screenshot regardless of overflow, so
 * a passing page can still be eyeballed.
 */
export async function inspectResponsive(
  page: Page,
  path: string,
  { detailed = false }: { detailed?: boolean } = {}
) {
  await assertPageHealthy(page, path);

  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowPx: el.scrollWidth - el.clientWidth,
    };
  });

  const project = test.info().project.name;
  const viewport = page.viewportSize();
  const base = join(OUT_DIR, `${project}__${slug(path)}`);

  if (overflow.overflowPx > 0) {
    writeFileSync(
      `${base}.json`,
      JSON.stringify({ path, project, viewport, ...overflow }, null, 2)
    );
  }

  if (detailed) {
    await page.screenshot({ path: `${base}.png`, fullPage: true });
  }
}
