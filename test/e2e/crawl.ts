import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const A11Y_DIR = "test-results/a11y";
mkdirSync(A11Y_DIR, { recursive: true });

/**
 * Visits `path` and fails the test only on genuine functional breakage: a
 * non-2xx/3xx response, a server-rendered Next.js error boundary, an
 * uncaught client exception, or a 500-level request. One `test()` per route
 * (see the *.crawl.spec.ts files) so the HTML report shows a clean per-page
 * pass/fail matrix instead of one giant test that stops at the first broken
 * page.
 *
 * Accessibility (axe-core) is scanned on every page but never fails the
 * test here — a single design-system contrast issue can affect dozens of
 * pages at once, and turning that into dozens of red test failures buries
 * the signal. Instead every scan's violations are written to
 * test-results/a11y/<slug>.json and compiled into one summary after the run
 * (see scripts/summarize-e2e.mjs).
 */
export async function inspectPage(page: Page, path: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("response", (res) => {
    if (res.status() >= 500) failedResponses.push(`${res.status()} ${res.url()}`);
  });

  const response = await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(250); // let toasts / client hydration settle

  expect(response, `no response for ${path}`).not.toBeNull();
  expect(
    response!.status(),
    `${path} returned ${response!.status()}`
  ).toBeLessThan(400);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  expect(
    bodyText,
    `${path} rendered a Next.js error boundary`
  ).not.toMatch(/Application error: a client-side exception has occurred/i);

  expect(pageErrors, `uncaught exception(s) on ${path}`).toEqual([]);
  expect(failedResponses, `500-level request(s) on ${path}`).toEqual([]);

  if (consoleErrors.length) {
    test.info().annotations.push({
      type: "console-errors",
      description: consoleErrors.join("\n"),
    });
  }

  const axe = await new AxeBuilder({ page }).exclude("iframe").analyze();
  if (axe.violations.length) {
    const slug = path.replace(/^\//, "").replace(/\//g, "_") || "root";
    writeFileSync(
      join(A11Y_DIR, `${slug}.json`),
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
