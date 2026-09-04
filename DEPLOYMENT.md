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
**Production** and **Preview**:

| var | required | notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | transaction pooler, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | ✅ | session pooler `:5432` (migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public — safe in the client bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **secret** — invites, seed auth users, storage writes |
| `NEXT_PUBLIC_SITE_URL` | ✅ | the production origin — used for links in outbound email |
| `CRON_SECRET` | ✅ | gates the 3 cron routes; Vercel Cron sends it as a bearer token |
| `RESEND_API_KEY` | ⬜ | email notifications no-op without it (in-app still works) |
| `EMAIL_FROM` | ⬜ | must be on a domain verified in Resend, else sends bounce |
| `DATABASE_URL_TEST` | ⬜ | CI only — never set in Vercel |

---

## 3. Vercel

1. Import the GitHub repo. Framework preset: **Next.js** (auto-detected).
2. Build command / output: defaults. `prisma generate` runs automatically via the
   `postinstall` hook if present, else add `prisma generate && next build` as the build
   command. *(Check: `package.json` has no `postinstall` — set the build command to
   `prisma generate && next build`.)*
3. Set the env vars from §2.
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

`prisma migrate deploy` is **not** run by `next build`. Run it against the production
database on every release, before the new build serves traffic:

```
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

(Use `DIRECT_URL` — migrations need a session connection, not pgbouncer.) Options:

- a manual step in your release checklist, or
- a Vercel "Deploy Hook" / GitHub Action that runs it on push to `main` before promoting.

All 43 migrations apply cleanly from an empty database (verified via
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
