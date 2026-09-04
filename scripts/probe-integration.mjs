/**
 * Run the integration suite against an isolated schema on the Supabase project
 * from `.env` — no Docker / local Postgres needed.
 *
 *   node scripts/probe-integration.mjs            # all integration tests
 *   node scripts/probe-integration.mjs votes      # just files matching "votes"
 *
 * Creates `ci_probe_<rand>`, applies every migration into it, runs the suite,
 * then drops the schema. `public` (the real data) is never touched — Prisma
 * binds the whole client to `?schema=`.
 *
 * NOTE: Supabase's session pooler caps a client at 15 connections, so the probe
 * URL pins `connection_limit=8`. CI uses a dedicated Postgres with no such cap.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const direct = env.DIRECT_URL;
if (!direct) {
  console.error("DIRECT_URL missing from .env");
  process.exit(1);
}

const schema = `ci_probe_${Math.random().toString(36).slice(2, 8)}`;
const sep = direct.includes("?") ? "&" : "?";
const probeUrl = `${direct}${sep}schema=${schema}&connection_limit=8`;
const filter = process.argv.slice(2).join(" ");

const run = (cmd, extraEnv) =>
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });

let failed = false;
try {
  console.log(`\n▶ migrate deploy → schema "${schema}"\n`);
  run("npx prisma migrate deploy", {
    DATABASE_URL: probeUrl,
    DIRECT_URL: probeUrl,
  });

  console.log(`\n▶ vitest --project integration ${filter}\n`);
  run(`npx vitest run --project integration ${filter}`.trim(), {
    DATABASE_URL_TEST: probeUrl,
  });
} catch {
  failed = true;
} finally {
  console.log(`\n▶ drop schema "${schema}"\n`);
  const p = new PrismaClient({ datasources: { db: { url: direct } } });
  await p.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await p.$disconnect();
}

process.exit(failed ? 1 : 0);
