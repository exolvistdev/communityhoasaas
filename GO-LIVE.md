# Go-live checklist

Work top to bottom. Details for each step are in `DEPLOYMENT.md`.

## Repo & CI

- [ ] GitHub repo created; `git remote add origin <url> && git push -u origin main`
- [ ] All 3 CI jobs green on `main` (**check** · **integration** · **build**)
- [ ] Branch protection on `main` — require the CI checks to pass before merge

## Secrets (do before the repo is shared)

- [ ] Database password rotated → `DATABASE_URL` + `DIRECT_URL` updated in Vercel + local `.env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` rotated → updated in Vercel + local
- [ ] `CRON_SECRET` generated (`openssl rand -hex 32`) → set in Vercel

## Supabase

- [ ] `prisma migrate deploy` run against the production database (`DIRECT_URL`)
- [ ] Storage buckets provisioned — `node --env-file=.env … scripts/provision-storage.ts`
- [ ] Auth → URL Configuration: Site URL + `…/**` redirect = production origin
- [ ] Confirm the pooled connection strings (transaction `:6543` for `DATABASE_URL`,
      session `:5432` for `DIRECT_URL`)

## Vercel

- [ ] Every env var from `DEPLOYMENT.md` §2 set for **Production** and **Preview**
- [ ] Build command = `prisma generate && next build`
- [ ] `NEXT_PUBLIC_SITE_URL` = production origin (email links break without it)
- [ ] `RESEND_API_KEY` set + `EMAIL_FROM` on a Resend-verified domain
      *(or accept: notifications are in-app only, email silently no-ops)*
- [ ] Custom domain attached; DNS verified
- [ ] First deploy succeeded

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
- [ ] **Postgres RLS not enabled** — tenant isolation is app-layer + org-per-user; design
      to add it is in `docs/rls-design.md`
- [ ] **Subdomain routing (`{sub}.hoasaas.ph`) not built** — it would be cosmetic only
      (a user can never reach another org). Revisit only if signup ever allows one user in
      multiple orgs.
- [ ] `prisma/seed.ts` must never run against production (it calls `resetDemoOrg()`)
