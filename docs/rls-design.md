# Postgres row-level security

## Baseline hardening — done

Migration `20260904190000_enable_rls_public` runs `ALTER TABLE ... ENABLE ROW
LEVEL SECURITY` (no `FORCE`, no policies) on every table in `public`, and
revokes all `anon`/`authenticated` table grants (`REVOKE ALL ...` +
`ALTER DEFAULT PRIVILEGES ... REVOKE ALL`, so future tables inherit no access
either).

This is **not** the tenant-isolation design below — it doesn't touch the app.
Prisma connects as `postgres`, which owns every table (confirmed live:
`SELECT tableowner FROM pg_tables WHERE schemaname='public'` → all `postgres`);
an owning role bypasses RLS unless `FORCE` is set, which this migration never
sets. So the app is unaffected (verified: full integration suite green in a
disposable probe schema with the migration applied, then a live smoke test
across `/dashboard`, `/elections`, `/board`, `/reports`, `/billing`, `/portal`
after applying it to `public`).

What it actually fixes: Supabase's PostgREST Data API
(`https://<ref>.supabase.co/rest/v1/<table>`) is always live and reachable with
nothing but the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` already shipped in the
browser bundle. Before this migration, the `anon` role held Supabase's default
table grants, so a direct request there could read/write these tables —
completely bypassing the app and its `orgId` checks. Verified before/after:
`GET /rest/v1/invoices` with the anon key went from returning real rows to
`401 permission denied for table invoices`. The app never uses this API (only
`.auth.*` and `.storage.*` — grepped, no `supabase.from(...)` table query
anywhere), so closing it costs nothing.

**Reminder:** a new table's migration must also enable RLS on it
(`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) — unlike grants, this doesn't
apply automatically to tables created later.

## Status: full tenant-isolation design — still deferred

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

The design below would be **defense-in-depth** (catch a query that forgets `orgId`;
contain a leaked connection string) on top of that, not a hole being filled — the actual
hole (Supabase's PostgREST Data API reachable with the public anon key) is the one closed
above. It's testable in the disposable probe schema (`npm run test:integration:probe`,
used to validate the baseline migration above), so "no local Postgres" is no longer a
blocker to building it — it remains deferred purely on cost/benefit: the app-layer
`orgId` convention plus the baseline hardening above already cover the realistic threat
model for a single-tenant-DB, org-per-user app.

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
