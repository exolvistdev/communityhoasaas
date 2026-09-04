import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * `deleteOrgCascade` (lib/org-teardown.ts) is the single teardown used by both
 * `resetDemoOrg()` and `resetTestOrg()`. Every tenant-scoped model must appear
 * in it — otherwise a fresh integration test that touches a new table will fail
 * on cleanup with an FK violation (exactly the bug this suite is meant to catch).
 */
const ROOT = join(__dirname, "..", "..");
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
const teardown = readFileSync(join(ROOT, "lib", "org-teardown.ts"), "utf8");

// Models that are global, not tenant-scoped — legitimately absent from the cascade.
const GLOBAL = new Set(["Organization", "PlatformAdmin"]);

const models = [...schema.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)].map(
  (m) => m[1]
);

describe("deleteOrgCascade parity", () => {
  it("covers every tenant-scoped model in the schema", () => {
    expect(models.length).toBeGreaterThan(30); // sanity — schema parsed

    const missing = models
      .filter((name) => !GLOBAL.has(name))
      .filter((name) => {
        const prop = name[0].toLowerCase() + name.slice(1);
        return !new RegExp(`\\bdb\\.${prop}\\.delete`).test(teardown);
      });

    expect(missing).toEqual([]);
  });

  it("deletes the organization row last", () => {
    expect(/db\.organization\.delete\([^)]*\);\s*\}\s*$/.test(teardown)).toBe(true);
  });
});
