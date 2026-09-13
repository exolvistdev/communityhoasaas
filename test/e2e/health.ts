import { expect, type Page } from "@playwright/test";

/** path -> filename-safe slug, shared by the a11y and responsive-overflow writers. */
export function slug(path: string): string {
  return path.replace(/^\//, "").replace(/\//g, "_") || "root";
}

/**
 * Navigates to `path` and fails the test on genuine functional breakage: a
 * non-2xx/3xx response, a server-rendered Next.js error boundary, an
 * uncaught client exception, or a 500-level request. Shared by crawl.ts (the
 * desktop crawl + a11y scan) and responsive/inspect.ts (the device-matrix
 * overflow check) so "what counts as broken" never drifts between the two.
 *
 * Returns the console errors seen (not treated as breakage — see crawl.ts).
 */
export async function assertPageHealthy(
  page: Page,
  path: string
): Promise<{ consoleErrors: string[] }> {
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

  return { consoleErrors };
}
