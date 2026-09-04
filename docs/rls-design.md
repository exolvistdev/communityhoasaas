# Postgres row-level security — design (not implemented)

## Status: deferred

Tenant isolation today is **application-layer**:

- **Org-per-user** — a `User` belongs to exactly one `Organization` (`User.orgId`). There
  is no cross-org membership.
- Every server-side read starts at `getCurrentOrgContext()` (`lib/tenant.ts`), which
  resolves the caller's org, and every tenant-scoped query passes `orgId` into its
  `where`. This is the documented convention and is enforced by code review + the
  integration suite.
- Prisma connects as the **table owner** role (`postgres.<ref>` on Supabase). That role
  bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set — so turning RLS on without the
  plumbing below would change nothing.

RLS is therefore **defense-in-depth** (catch a query that forgets `orgId`; contain a
leaked connection string), not a hole being filled. It also can't be integration-tested on
the dev machine (no local Postgres) — only in CI. Given the cost/benefit and that nothing
is deployed yet, it's deferred.

## The design, when it's built

### 1. Migration — enable + force + policy

For every table with an `orgId` column (~35 — `accounts`, `properties`, `invoices`,
`journal_entries`, `bills`, `vendors`, `violations`, `board_votes`, `water_meters`, … — plus
`journal_lines`, `ballots`, `meter_readings` etc. which reach org through a parent):

```sql
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE  ROW LEVEL SECURITY;      -- owner is subject to policies too

CREATE POLICY tenant_isolation ON "accounts"
  USING      ("orgId" = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true)::uuid);
```

`current_setting(…, true)` returns NULL when unset → the predicate is false → **zero rows**
(fail closed). Child tables use a subquery predicate against the parent
(`"voteId" IN (SELECT id FROM board_votes WHERE "orgId" = …)`).

A dedicated **`app_unscoped`** role with `BYPASSRLS` is created for the escape-hatch client
(below) so cron/platform/seed still see everything.

### 2. Prisma — set the GUC per request

```ts
// lib/tenant-context.ts
import { AsyncLocalStorage } from "node:async_hooks";
export const orgStore = new AsyncLocalStorage<{ orgId: string }>();
```

`getCurrentOrgContext()` wraps the rest of the request in `orgStore.run({ orgId }, …)` —
or, more practically, a `middleware`/route wrapper does.

```ts
// lib/prisma.ts
export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const ctx = orgStore.getStore();
        if (!ctx) return query(args); // unscoped path (see below)
        return prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`;
          return query(args);
        });
      },
    },
  },
});
```

`set_config(…, true)` is `SET LOCAL` — scoped to the transaction, so it can't leak between
pooled requests.

### 3. The unscoped client

```ts
// lib/prisma-unscoped.ts — connects as app_unscoped (BYPASSRLS)
export const prismaUnscoped = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_UNSCOPED } },
});
```

Used by: the 3 cron sweeps (`lib/late-fees.ts`, `lib/notifications.ts`
`generateOverdueNotifications`, `lib/water-reminders.ts`), the platform-admin console
(`app/platform/**`), impersonation resolution, `prisma/seed.ts`, and `/api/health`.

### 4. Rollout

- Ship behind `RLS_ENABLED` (env). Migration runs regardless; the Prisma extension only
  sets the GUC when the flag is on, so you can enable per-environment.
- New `test/integration/rls.test.ts`: a raw query with no GUC set returns 0 rows; a
  scoped query returns only its org's rows; a write with a mismatched `orgId` is rejected
  by `WITH CHECK`.
- Enable on staging first; watch for any page that 500s or renders empty (= a query path
  that isn't inside `orgStore.run`).

### Risk

Touches every read path. A missed wrapper doesn't corrupt data — it just returns nothing —
but it's a visible outage. Needs the full smoke test + a click-through of every section
per environment before flipping the flag.
