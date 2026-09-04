# Deployment

The app is a standard Next.js 14 (App Router) deploy: **Vercel** for the app, **Supabase**
for Postgres + Auth + Storage. Nothing here is Vercel-specific except `vercel.json` (cron
schedules) — any Node host works if you run the three cron routes on a scheduler yourself.

---

## 1. Supabase

The Supabase project already exists (it's what `.env` points at).

### Connection strings

| var | pooler | port | used by |
| --- | --- | --- | --- |
| `DATABASE_URL` | **transaction** mode | `6543` | the app at runtime — must carry `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | **session** mode | `5432` | `prisma migrate deploy` only |

Both are under Supabase → Settings → Database → Connection string (use the "URI" tab, and
pick the pooled hosts, not the direct `db.<ref>.supabase.co` host — serverless functions
exhaust direct connections).

### Storage buckets

Five buckets: `documents`, `maintenance`, `marketplace`, `payment-qr`, `violations`. The
demo seed creates them; **production must provision them once**:

```
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/provision-storage.ts
```

(Idempotent — each `ensure*Bucket` no-ops if the bucket exists. Needs
`SUPABASE_SERVICE_ROLE_KEY`.)

### Auth URL configuration

Supabase → Authentication → URL Configuration:

- **Site URL** = the production origin (e.g. `https://app.example.com`)
- **Redirect URLs** — add `https://app.example.com/**`

Invite links, password-reset links and magic links all resolve against these. If they're
still `localhost`, invited staff can't accept.

---

## 2. Environment variables

Set every one of these in Vercel (Project → Settings → Environment Variables), for
**Production** and **Preview**. `.env` is git-ignored, so Vercel has **nothing** until you
add them here — a missing `DATABASE_URL` fails every request with
`PrismaClientInitializationError` (see Troubleshooting). **Changing a variable takes effect
only on the next deploy** — redeploy after editing.

| var | required | notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | transaction pooler, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | ✅ | session pooler `:5432` (migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public — safe in the client bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **secret** — invites, seed auth users, storage writes |
| `NEXT_PUBLIC_SITE_URL` | ✅ | the deployed origin (`https://<project>.vercel.app` or your domain) — **never `localhost`**; used for links in outbound email |
| `CRON_SECRET` | ✅ | gates the 3 cron routes; Vercel Cron sends it as a bearer token |
| `RESEND_API_KEY` | ⬜ | email notifications no-op without it (in-app still works) |
| `EMAIL_FROM` | ⬜ | must be on a domain verified in Resend, else sends bounce |
| `DATABASE_URL_TEST` | ⬜ | CI only — never set in Vercel |

Values come straight from your local `.env` (same Supabase project) — **except**
`NEXT_PUBLIC_SITE_URL`, which must be the deployed origin.

---

## 3. Vercel

1. Import the GitHub repo. Framework preset: **Next.js** (auto-detected).
2. Build command / output: **defaults** — the repo's `build` script is
   `prisma generate && next build`, so the Prisma client is regenerated on every build
   (Vercel's cached `node_modules` can otherwise ship a stale client). No custom build
   command needed.
3. Set the env vars from §2 **before** the first deploy. The `next.config.mjs` build guard
   aborts the build with a clear message if `DATABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing.
4. `vercel.json` already declares 3 daily crons:
   - `/api/cron/overdue` — 01:00 UTC — overdue-invoice notifications
   - `/api/cron/late-fees` — 02:00 UTC — late-fee sweep
   - `/api/cron/water-reminder` — 04:00 UTC — water-reading reminders
   Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`; no extra config.
5. **Function duration** — `/reports/board-pack` fans out a lot of queries. If it ever
   times out (default 10s on Hobby, 15s Pro), add to `vercel.json`:
   ```json
   "functions": { "app/reports/board-pack/page.tsx": { "maxDuration": 30 } }
   ```

---

## 4. Migrations

**Production Vercel builds run `prisma migrate deploy` automatically** —
`scripts/prebuild-migrate.mjs` (wired into the `build` script) applies pending
migrations before `next build` whenever `VERCEL_ENV === "production"`. So a schema change
ships ahead of the code that needs it, and a broken migration fails the build instead of
500-ing prod. Preview builds and local builds skip it.

For a one-off (a rollback, or applying migrations without a deploy), run it by hand
against `DIRECT_URL` (session connection — migrations don't go through pgbouncer):

```
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

To move back to a manual gate, drop `node scripts/prebuild-migrate.mjs` from the `build`
script. All 43 migrations apply cleanly from an empty database (verified via
`npm run test:integration:probe`).

---

## 5. Post-deploy smoke test

```
curl -s https://app.example.com/api/health            # → {"ok":true,"db":"up",...}
```

Then in a browser:

- log in as an admin → `/dashboard` loads
- open one report (`/reports/income-statement`) and `/reports/board-pack`
- `curl -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/overdue`
  → `{"ok":true,...}`

Full pre-launch list: **`GO-LIVE.md`**.

---

## 6. Rotating secrets

Do this once before the repo gets a remote anyone else can clone. `.env` was never
committed (`git log --all -- .env` is empty), so this is precautionary, not incident
response.

### Database password

1. Supabase → Settings → Database → **Reset database password**.
2. Update `DATABASE_URL` **and** `DIRECT_URL` everywhere: Vercel env (Production +
   Preview), your local `.env`, any CI secret.
3. Redeploy (Vercel) so functions pick up the new value.

### API keys (`service_role` / `anon`)

1. Supabase → Settings → API → **rotate**. `anon` is public (`NEXT_PUBLIC_…`), low stakes;
   `service_role` is the one that matters.
2. Update `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if you rotated
   anon) in Vercel + local.
3. Redeploy.

### `CRON_SECRET`

1. `openssl rand -hex 32` → new value.
2. Update it in Vercel. Vercel Cron uses the new value on the next deploy.

After any rotation, re-run the §5 smoke test. Existing user sessions stay valid — the JWT
signing secret is separate and is not rotated here.

---

## 7. Troubleshooting

### `PrismaClientInitializationError: … DATABASE_URL resolved to an empty string`

Every page 500s. `DATABASE_URL` (and probably the rest) is **not set in Vercel**, or was
set for the wrong environment (Preview but not Production), or was set but there's been no
redeploy since. Fix:

1. Add all `✅` vars from §2 for **Production**.
2. **Deployments → ⋯ → Redeploy** — env changes don't apply to the running deployment.
3. `curl https://<app>/api/health` → `{"ok":true,"db":"up"}`.

`next.config.mjs` now aborts the *build* when `DATABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing on Vercel, so a
future env-less deploy fails visibly instead of shipping a 500.

### `@prisma/client did not initialize yet. Please run "prisma generate"`

The generated client is stale/absent. The repo `build` script runs `prisma generate`, so
a plain redeploy usually fixes it. If it persists, **redeploy with the build cache
cleared** (Deployments → ⋯ → Redeploy → untick "Use existing Build Cache").

### `prepared statement "s0" already exists` / connection timeouts / "too many connections"

`DATABASE_URL` is pointed at the direct DB host or the session pooler. It must be the
**transaction** pooler (`:6543`) with `?pgbouncer=true&connection_limit=1`. `DIRECT_URL`
(`:5432`, session pooler) is for migrations only.

### Invite / reset links point at `localhost`

`NEXT_PUBLIC_SITE_URL` is unset or still the `.env` dev value — set it to the deployed
origin and redeploy. Also add that origin to Supabase → Auth → URL Configuration (§1).
