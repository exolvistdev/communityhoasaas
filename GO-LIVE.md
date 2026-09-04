# Go-live checklist

Work top to bottom. Details for each step are in `DEPLOYMENT.md`.

## Done

- [x] GitHub repo (`exolvistdev/communityhoasaas`) + `main` pushed
- [x] Vercel project connected; env vars set for Production; deploy is up
      (`/api/health` → ok)
- [x] Prod DB migrated — prod uses the **same Supabase project** as local `.env`,
      already at all 43 migrations (47 tables)
- [x] Storage buckets — all 5 (`marketplace`, `documents`, `payment-qr`, `violations`,
      `maintenance`) already exist on that project
- [x] `prisma/seed.ts` guarded against production
- [x] Production Vercel builds run `prisma migrate deploy` automatically
      (`scripts/prebuild-migrate.mjs`)

## Repo & CI

- [ ] All 3 CI jobs green on `main` — https://github.com/exolvistdev/communityhoasaas/actions
- [ ] Branch protection on `main` — require the CI checks to pass before merge

## Supabase — still required

- [ ] **Auth → URL Configuration**: Site URL + `…/**` redirect = the Vercel origin.
      Until this is set, invite / password-reset links point at `localhost`.

## Vercel — verify

- [ ] `NEXT_PUBLIC_SITE_URL` = the deployed origin, **not** the `localhost` value from
      `.env` (redeploy if you change it)
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` on a Resend-verified domain — or accept email
      no-ops (in-app notifications still work)
- [ ] Node version 22.x or 24.x (Project → Settings → General) — `@supabase/supabase-js`
      wants Node ≥ 22
- [ ] Custom domain (optional)

## Secrets — precautionary (`.env` was never committed, so not urgent)

- [ ] Rotate DB password / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` per
      `DEPLOYMENT.md §6` — do it before anyone else can clone the repo

## Smoke test (post-deploy)

- [ ] `GET /api/health` → `{"ok":true,"db":"up"}`
- [ ] Log in as an admin; `/dashboard`, `/reports/income-statement`, `/reports/board-pack` all load
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" <origin>/api/cron/overdue` → `{"ok":true}`
- [ ] Onboard a throwaway org via `/onboarding`; confirm it's isolated from the demo org
- [ ] Send a staff invite; open the link in a fresh browser; accept it

## Manual print / PDF pass

No headless-print tooling exists here — a human runs this once. For each of
`/reports/{income-statement, balance-sheet, aging, payables, collections, late-fees,
vendor-spend, violations, homeowners, water}` **and** `/reports/board-pack`:

- [ ] ⌘P / Ctrl-P preview: table headers repeat on every page; rows don't split mid-row
- [ ] charts render at a fixed size (not blank / 0×0)
- [ ] on-screen filter chips / interactive highlights are **gone** in the printout
      (the print output is always the unfiltered report)
- [ ] `@page` margins look right; nothing clipped at the edge

## Known / accepted

- [ ] `<img>` lint warnings in `app/portal/market/**` and `app/(admin)/marketplace/**`
      — cosmetic (`next/image` migration is optional, tracked as future work)
- [x] **Postgres RLS** — baseline hardening is live (migration
      `20260904190000_enable_rls_public`: RLS enabled on every `public` table, no
      policies, `anon`/`authenticated` grants revoked — closes the PostgREST/anon-key
      exposure; app is unaffected since Prisma connects as the owning role). Tenant
      isolation stays app-layer + org-per-user; the fuller per-org-policy design is in
      `docs/rls-design.md`, still deferred
- [ ] **Subdomain routing (`{sub}.hoasaas.ph`) not built** — it would be cosmetic only
      (a user can never reach another org). Revisit only if signup ever allows one user in
      multiple orgs.
- [ ] `prisma/seed.ts` must never run against production (it calls `resetDemoOrg()`)
