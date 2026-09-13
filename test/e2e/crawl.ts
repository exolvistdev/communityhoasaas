import { test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { assertPageHealthy, slug } from "./health";

const A11Y_DIR = "test-results/a11y";
mkdirSync(A11Y_DIR, { recursive: true });

/**
 * Visits `path` (see `assertPageHealthy` in ./health for what counts as a
 * failure) and additionally runs an axe-core accessibility scan. One
 * `test()` per route (see the *.crawl.spec.ts files) so the HTML report
 * shows a clean per-page pass/fail matrix instead of one giant test that
 * stops at the first broken page.
 *
 * Accessibility (axe-core) is scanned on every page but never fails the
 * test here — a single design-system contrast issue can affect dozens of
 * pages at once, and turning that into dozens of red test failures buries
 * the signal. Instead every scan's violations are written to
 * test-results/a11y/<slug>.json and compiled into one summary after the run
 * (see scripts/summarize-e2e.mjs).
 */
export async function inspectPage(page: Page, path: string) {
  const { consoleErrors } = await assertPageHealthy(page, path);

  if (consoleErrors.length) {
    test.info().annotations.push({
      type: "console-errors",
      description: consoleErrors.join("\n"),
    });
  }

  const axe = await new AxeBuilder({ page }).exclude("iframe").analyze();
  if (axe.violations.length) {
    writeFileSync(
      join(A11Y_DIR, `${slug(path)}.json`),
      JSON.stringify(
        {
          path,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.length,
          })),
        },
        null,
        2
      )
    );
  }
}
