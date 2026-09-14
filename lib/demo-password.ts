/**
 * The password `prisma/seed.ts` sets on every demo/seed account, shared with
 * everything that logs into those accounts (the Playwright e2e suite, the
 * marketing-screenshot capture script). Single source of truth so a future
 * change to the default or the env var name can't drift between call sites.
 *
 * Overridable via `SEED_PASSWORD` so a shared (or production-adjacent)
 * Supabase project doesn't have to run every seeded account on a password
 * published in this public repo's history. `||`, not `??` — `.env.example`
 * ships this as `""`, and an empty string must still fall back to the
 * default, not become the literal password.
 *
 * A function, not a top-level constant: some callers (e.g. the standalone
 * marketing-screenshot script) load `.env` themselves via `process.loadEnvFile()`
 * as one of their own first statements — a plain `import`-time constant here
 * would read `process.env` before that runs, since ES module imports always
 * evaluate before the importing file's own body. Reading it lazily, at call
 * time, means it always sees whatever `.env` loading the caller already did.
 */
export function demoPassword(): string {
  return process.env.SEED_PASSWORD || "demo-password-123";
}
