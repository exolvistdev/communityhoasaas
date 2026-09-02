// Runs before any integration test file is imported.
//
// The app's Prisma singleton (`lib/prisma.ts`) reads DATABASE_URL at construction
// time, and every ledger/close-out helper imports that singleton. So to point the
// whole dependency graph at a throwaway Postgres we copy DATABASE_URL_TEST over
// DATABASE_URL/DIRECT_URL here, before those modules load.
//
// When DATABASE_URL_TEST is unset (the normal local case) we leave the env alone;
// the test bodies are wrapped in `describe.skipIf(!process.env.DATABASE_URL_TEST)`
// so nothing connects.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.DIRECT_URL = process.env.DATABASE_URL_TEST;
}
