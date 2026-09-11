/**
 * Captures real screenshots of the running app for the marketing site.
 * Re-run this after a UI redesign to refresh the marketing images.
 *
 * Prerequisites:
 *   1. `npm run build && npx next start -p 3019` (a production build — no dev
 *      overlay, matches what a real visitor's screenshot would look like)
 *   2. `npm i -D playwright` (already a devDependency) + a cached browser:
 *      `npx playwright install chromium` (one-time, ~150–300MB, not committed)
 *   3. The `sample-hoa` demo org seeded (`npm run db:seed`) against whatever
 *      DATABASE_URL is active for that server.
 *
 * Run:  npx tsx scripts/capture-marketing-screenshots.ts [baseUrl]
 *       (baseUrl defaults to http://localhost:3019)
 */
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.argv[2] ?? "http://localhost:3019";
const OUT_DIR = path.join(__dirname, "..", "public", "marketing");
const PASSWORD = "demo-password-123";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

type Shot = {
  file: string;
  email: string;
  path: string;
  viewport: typeof DESKTOP | typeof PHONE;
  /** A selector to wait for before capturing, beyond basic network-idle. */
  waitFor: string;
};

const SHOTS: Shot[] = [
  {
    file: "dashboard.png",
    email: "admin@sample-hoa.ph",
    path: "/dashboard",
    viewport: DESKTOP,
    waitFor: "text=Dashboard",
  },
  {
    file: "ledger.png",
    email: "admin@sample-hoa.ph",
    path: "/ledger",
    viewport: DESKTOP,
    waitFor: "table",
  },
  {
    file: "gate-passes.png",
    email: "admin@sample-hoa.ph",
    path: "/gate-passes",
    viewport: DESKTOP,
    waitFor: "table",
  },
  {
    file: "portal.png",
    email: "juan@example.com",
    path: "/portal",
    viewport: PHONE,
    waitFor: "text=/Balance|Amount due/",
  },
  {
    file: "portal-pay.png",
    email: "juan@example.com",
    path: "/portal/pay",
    viewport: PHONE,
    waitFor: "text=GCash",
  },
  {
    file: "portal-amenities.png",
    email: "juan@example.com",
    path: "/portal/amenities",
    viewport: PHONE,
    waitFor: "body",
  },
];

async function login(page: Page, email: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  try {
    // One context per persona so sessions don't bleed between shots.
    const byEmail = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();

    for (const shot of SHOTS) {
      let ctx = byEmail.get(shot.email);
      if (!ctx) {
        ctx = await browser.newContext({
          viewport: shot.viewport,
          deviceScaleFactor: 2,
        });
        const page = await ctx.newPage();
        await login(page, shot.email);
        await page.close();
        byEmail.set(shot.email, ctx);
      }
      // Otherwise reuse the already-logged-in context — its previous page was
      // closed at the end of that iteration below.

      const page = await ctx.newPage();
      await page.setViewportSize(shot.viewport);
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle" });
      // Best-effort — networkidle on an SSR page is usually enough on its own;
      // don't fail the whole run if a wording tweak makes this selector miss.
      await page.locator(shot.waitFor).first().waitFor({ timeout: 8_000 }).catch(() => {
        console.warn(`  (waitFor "${shot.waitFor}" didn't appear for ${shot.file} — capturing anyway)`);
      });
      // Let any entrance animation / toast settle.
      await page.waitForTimeout(400);
      const dest = path.join(OUT_DIR, shot.file);
      await page.screenshot({ path: dest });
      console.log(`✓ ${shot.file} (${shot.viewport.width}x${shot.viewport.height} @2x)`);
      await page.close();
    }

    for (const ctx of byEmail.values()) await ctx.close();
    console.log(`\nDone — ${SHOTS.length} screenshots in ${OUT_DIR}`);
  } finally {
    // Always tear the browser down, even if a shot above threw.
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
