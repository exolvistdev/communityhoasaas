#!/usr/bin/env node
// Compiles test-results/a11y/*.json (written by test/e2e/crawl.ts) into one
// accessibility summary grouped by axe rule, test-results/responsive/*.json
// (written by test/e2e/responsive/inspect.ts) into a horizontal-overflow
// rollup grouped by route across the device matrix, and test-results/results.json
// (the Playwright JSON reporter, configured in playwright.config.ts) into a
// loud list of skipped tests — a skip can mean a flow (e.g. "confirm a
// pending payment") went unexercised this run, and that's easy to miss
// buried in a green "N passed" terminal summary.
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const RESULTS_FILE = "test-results/results.json";
if (existsSync(RESULTS_FILE)) {
  const report = JSON.parse(readFileSync(RESULTS_FILE, "utf8"));
  const skipped = [];
  const walk = (suite, titlePath) => {
    for (const spec of suite.specs ?? []) {
      const path = [...titlePath, spec.title];
      for (const test of spec.tests ?? []) {
        const result = test.results?.at(-1);
        if (result?.status === "skipped") {
          const reason = test.annotations?.find((a) => a.type === "skip")
            ?.description;
          skipped.push({ title: path.join(" › "), reason });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, titlePath);
  };
  for (const suite of report.suites ?? []) walk(suite, []);

  if (skipped.length) {
    console.log(
      `\n⚠ ${skipped.length} test(s) SKIPPED this run — the flow was not exercised:\n`
    );
    for (const s of skipped) {
      console.log(`- ${s.title}${s.reason ? ` — ${s.reason}` : ""}`);
    }
  } else {
    console.log("\nNo skipped tests this run.");
  }
} else {
  console.log(
    `\nNo ${RESULTS_FILE} — run \`npm run test:e2e\` first (needs the "json" reporter in playwright.config.ts).`
  );
}

const DIR = "test-results/a11y";
if (existsSync(DIR)) {
  const byRule = new Map();
  for (const file of readdirSync(DIR)) {
    if (!file.endsWith(".json")) continue;
    const { path, violations } = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    for (const v of violations) {
      const key = v.id;
      if (!byRule.has(key)) byRule.set(key, { ...v, pages: [] });
      byRule.get(key).pages.push({ path, nodes: v.nodes });
    }
  }

  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rules = [...byRule.values()].sort(
    (a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9)
  );

  console.log(`\n${rules.length} distinct accessibility rule(s) violated across the crawl:\n`);
  for (const r of rules) {
    const totalNodes = r.pages.reduce((s, p) => s + p.nodes, 0);
    console.log(
      `- [${r.impact}] ${r.id} — ${r.help}\n` +
        `  ${r.pages.length} page(s), ${totalNodes} node(s) total. ${r.helpUrl}\n` +
        `  pages: ${r.pages.map((p) => p.path).join(", ")}`
    );
  }
} else {
  console.log("\nNo test-results/a11y directory — run the desktop crawl specs first (npm run test:e2e).");
}

// Responsive (mobile/tablet/foldable) — written by test/e2e/responsive/inspect.ts,
// one file per project+route that had horizontal overflow. Grouped by route so
// "these 7 devices all overflow on /reports/homeowners" reads as one finding.
const RESPONSIVE_DIR = "test-results/responsive";
if (existsSync(RESPONSIVE_DIR)) {
  const byPath = new Map();
  for (const file of readdirSync(RESPONSIVE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const rec = JSON.parse(readFileSync(join(RESPONSIVE_DIR, file), "utf8"));
    if (!byPath.has(rec.path)) byPath.set(rec.path, []);
    byPath.get(rec.path).push(rec);
  }
  const paths = [...byPath.keys()].sort();
  if (paths.length) {
    console.log(
      `\n⚠ Horizontal overflow on ${paths.length} route(s) across the device matrix:\n`
    );
    for (const path of paths) {
      const hits = byPath.get(path).sort((a, b) => b.overflowPx - a.overflowPx);
      console.log(`- ${path}`);
      for (const h of hits) {
        console.log(
          `    ${h.project} (${h.viewport.width}×${h.viewport.height}) — overflows by ${h.overflowPx}px`
        );
      }
    }
  } else {
    console.log("\nNo horizontal overflow found across the device matrix.");
  }
} else {
  console.log(
    "\nNo test-results/responsive directory — run the responsive device projects first (npm run test:e2e)."
  );
}
