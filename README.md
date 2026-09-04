# HOA Management SaaS — MVP

Multi-tenant HOA (homeowners association) management platform for the Philippine
market. Each HOA is an isolated tenant. See [`docs/`](docs/) for the Statement of
Work and Wireframe Brief, and [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) for a
walkthrough of the admin app.

## Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Prisma** + **PostgreSQL** (hosted on Supabase)
- **Supabase Auth** for sign-in / invites
- **Tailwind CSS** with a semantic token layer (`app/globals.css`) — light + dark
  (`next-themes`), Inter (`next/font`), `lucide-react` icons, and a small
  primitive set in `components/ui/` (Button, Card, Field, Badge, Table,
  EmptyState, Toast)

## What's built

| Area | Status |
| --- | --- |
| Onboarding — org + admin sign-up, CSV property import | ✅ |
| Admin dashboard | ✅ |
| Properties — list, detail, people (owner/co-owner/renter), rate plans, archive, close-out / ownership transfer (settle or write off the balance, swap residents, revoke logins) | ✅ |
| Billing — bulk invoice generation, record payment (auto-split oldest-first across open invoices), overpayment → resident credit auto-applied to the next dues, refund a credit balance, void (a paid invoice's money moves to credit), Statement of Account (single + bulk + CSV) | ✅ |
| Reconciliation — confirm/reject homeowner-submitted payments (allocated on confirm) | ✅ |
| Ledger — trial balance (any date range), journal, chart of accounts (~19 accounts), manual / expense / other-income journal entries with reversals, CSV export | ✅ |
| Vendors & bills (accounts payable) — vendor directory, record a bill (books the expense + a 2000 A/P liability), pay it in full or part, void, an AP-aging report by vendor; the balance sheet shows real payables | ✅ |
| Maintenance / work orders — residents file repair requests (category, photos, common-area flag) from the portal; staff triage a queue, assign a person / vendor, link a bill, post public or internal comments; both sides get notified | ✅ |
| Board meetings — schedule a meeting with an agenda, residents RSVP (going / maybe / no) from the portal, staff see the tally and publish the minutes (filed to the document library); residents notified on schedule / reschedule / minutes | ✅ |
| Violations & fines — log a rule violation (category, photos, cure-by date), track it to resolution, serve numbered fine notices that bill the resident (4300 Fine Income), print a demand letter; residents see their violations and can appeal | ✅ |
| Financial reports (`/reports`) — up to ten reports: income & expenses, financial position, receivables aging, payables aging, collections summary, late fees, vendor spend, violations & fines, homeowners roster, and water (consumption by unit & month, utility cost vs. billed — shown only for metered HOAs); each with Recharts charts (trend / bucket / donut) that print, plus click-to-filter and month drill-down on screen; a board pack bundles the first five with opt-in checkboxes for the extras; period picker, print-to-PDF, CSV per report | ✅ |
| Gate passes — create / list / revoke, scannable code | ✅ |
| Announcements — draft / publish | ✅ |
| Team — invite staff/guard by email, role management | ✅ |
| Settings — HOA name, billing due-day, rate plans, default rates by property type, GCash/Maya payment details + uploadable QR, late-fee policy | ✅ |
| Late fees — opt-in per HOA (flat ₱ or %, grace period, monthly recurrence cap); a daily sweep posts a late-fee invoice + ledger entry and notifies the homeowner | ✅ |
| Board votes (RA 9904) — put a motion to the members, one ballot per unit (in favour / against / abstain), proxy assignment, quorum + threshold tracking, publish the result to the document library | ✅ |
| Board elections (RA 9904) — multi-seat "vote for up to N" trustee elections: staff enter a candidate slate, members endorse up to N candidates per unit from the portal, top N win (ties for the last seat flagged for a runoff). Finalizing seats the winners on the **Board of Trustees roster** (`/board` + a portal "Your Board" view) with term dates and single-holder officer positions (chair / vice / secretary / treasurer), and can bump their role to Board Member. Staff can also appoint a trustee directly or end a term early. A configurable "months in arrears" setting (`electionArrearsMonths`) suspends a delinquent unit from voting or running — on elections *and* resolution votes: a delinquent member can't be added to a slate, and a candidate whose unit falls behind mid-election drops off the winner list (the next candidate takes the seat). Staff can download the full tally as CSV and reinstate a trustee whose term was ended early. Board meetings, votes and elections share a dedicated "Board & governance" notification category. | ✅ |
| Water — asked at onboarding how the subdivision gets water (own source / one master meter from a utility / direct utility accounts); the last hides water billing entirely. **Own source** — tiered rate bands + a service charge, staff readings, a batch action bills each unit to 4400 Water Income. **Master meter** — the utility bill is a real Bill to 5150 Water Purchased; a sub-meter reading run splits it across units (loss distributed pro-rata or absorbed by the HOA, optional flat admin fee), snapshotted per period; common-area meters (clubhouse, park) are read, subtracted from loss, and HOA-funded. Meter replacement (retire + fresh baseline), suspicious-reading flag, estimated readings (trailing-3-average, auto true-up on the next actual), and a "correct a billed reading" action (over-bill → resident credit, under-bill → extra invoice). A daily cron nudges staff when readings are overdue. Residents see their readings, a 12-month consumption chart and a per-bill breakdown at `/portal/water`; staff get a `/reports/water` report. | ✅ |
| RBAC — ADMIN / TREASURER / BOARD_MEMBER / GUARD / HOMEOWNER | ✅ |
| Password recovery (self-service + admin reset-link fallback), `/account` self-service profile/password/contact | ✅ |
| Gate activity log + admin audit trail (`/gate-passes?view=activity`, `/audit`) | ✅ |
| Homeowner portal (§4.4) — balance + breakdown, payment history w/ pending/rejected status, Pay Now, own statement, gate-pass request (QR), announcements; one login can own several units (unit switcher); a staff member who also owns a unit gets a "Resident view" | ✅ |
| Guard portal (§4.5) — QR camera scan or manual code, valid/expired/revoked/used verdict + scan log | ✅ |
| Visitor pass page `/pass/<code>` — public QR + validity for the visitor to show at the gate | ✅ |
| Platform operator console `/platform` — cross-tenant org directory + full user impersonation for support | ✅ |
| Resident marketplace (Phase 2) — listings with photos, buyer-seller message threads, admin moderation | ✅ |
| Amenity booking (Phase 2) — bookable amenities, time-slot reservations, staff approval, invoiced fees | ✅ |
| Notifications — in-app center (bell + `/notifications`) and email for billing, announcements, amenities, marketplace, with a per-user preferences panel in `/account` | ✅ |
| Document library — staff upload bylaws / minutes / financials / forms (`/documents`, private Storage bucket, optional staff-only); homeowners browse & download in the portal | ✅ |
| Data privacy (RA 10173) — self-service data export (`/account/export`), account-deletion request queue for admins (`/data-requests`), public `/privacy` policy | ✅ |

Payments: no PayMongo. Homeowners pay via GCash/Maya — the HOA uploads its
"Receive Money" QR in Settings (a scannable QR can't be derived from a phone
number alone), shown alongside the account details on Pay Now — then submit the
reference; an admin confirms it in **Reconciliation**, which posts it to the
ledger.

## Setup

```bash
npm install
```

Create `.env` (it is git-ignored):

```
# Supabase → Database → Connection string
DATABASE_URL="postgresql://…@…pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"  # transaction pooler
DIRECT_URL="postgresql://…@…pooler.supabase.com:5432/postgres"                                       # session pooler / direct — prisma migrate
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="…"                    # Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY="…"                        # invites, seed auth users, marketplace photos, document library
RESEND_API_KEY=""                                    # optional — email notifications no-op without it (in-app center still works)
EMAIL_FROM="HOA SaaS <onboarding@resend.dev>"        # sender for notification emails
CRON_SECRET=""                                       # optional — gates the daily sweeps GET /api/cron/overdue, /api/cron/late-fees and /api/cron/water-reminder (vercel.json)
```

Use the **transaction-mode pooler** (`:6543`, `pgbouncer=true`) for `DATABASE_URL`
so the app doesn't exhaust the session pooler's connection limit; `DIRECT_URL`
(`:5432`) is only used by `prisma migrate`.

In the Supabase dashboard: **Authentication → Providers → Email** — either turn
off "Confirm email" or keep `SUPABASE_SERVICE_ROLE_KEY` set (onboarding and
invites use the service role to pre-confirm accounts).

```bash
npx prisma migrate deploy   # apply migrations (use `prisma migrate dev` when authoring new ones)
npx prisma generate
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/init-storage.ts  # once per Supabase project — creates the marketplace + payment-qr (public) and documents + violations + maintenance (private) Storage buckets
npm run db:seed             # demo HOA "sample-hoa" (also ensures the bucket)
npm run dev
```

### Seed logins

All use password `demo-password-123`:

| Role | Email |
| --- | --- |
| Admin | `admin@sample-hoa.ph` |
| Treasurer | `treasurer@sample-hoa.ph` |
| Board member | `board@sample-hoa.ph` (also owns Blk 2 Lot 5 — "Resident view") |
| Guard | `guard@sample-hoa.ph` |
| Homeowner | `juan@example.com` (owns two units — Blk 1 Lot 1 and Blk 1 Lot 3) |
| Homeowner | `ana@example.com` |
| Platform operator | `superadmin@hoasaas.ph` (sign in at `/platform/login`) |

## Project layout

```
app/
  (admin)/            staff app — dashboard, properties, billing, reconciliation,
                      ledger, gate-passes, announcements, team, settings
  onboarding/         org + admin sign-up wizard
  statements/         printable Statement of Account (kept outside the sidebar chrome)
  reports/            printable financial reports + board pack (staff-only, print-to-PDF)
  accept-invite/      set-password page for invited users
  portal/             homeowner portal — balance, Pay Now, gate-pass request,
                      announcements, marketplace, messages
  guard/              guard portal — enter a pass code, get a valid/expired/revoked/used verdict
  platform/           platform-operator console (own login) — org directory + impersonation
  login/  auth/
lib/
  prisma.ts           Prisma singleton
  tenant.ts           getCurrentOrgContext — every server query scopes by org
  rbac.ts / permissions.ts   role checks (requireStaff / denyUnless / can)
  ledger.ts           double-entry posting (invoice issued / voided / payment)
  soa.ts              Statement of Account builder
  csv.ts              property-import CSV parsing
  invites.ts          Supabase invite-link generation
  impersonation.ts    cookie-backed platform-admin impersonation
  storage.ts / marketplace.ts   Supabase Storage bucket + marketplace helpers
components/            shared UI (Sidebar, StatusBadge, PropertyCsvImport, …)
prisma/
  schema.prisma       data model
  migrations/          hand-written SQL migrations, applied with `migrate deploy`
  seed.ts
scripts/
  init-storage.ts     one-off: create the "marketplace" + "documents" Storage buckets
```

## Tests

```bash
npm test            # vitest — unit suite always runs; integration skips without a DB
npm run test:unit   # pure-function suite only (no database)
npm run typecheck   # tsc --noEmit
```

- **Unit** (`test/unit/`) — pure helpers: permissions, CSV import, statement math
  (`assembleStatement`), late-fee policy, gate-pass validation, amenity time rules,
  formatting, notification preferences. No database; always runs.
- **Integration** (`test/integration/`, 16 files / 47 tests) — the double-entry ledger
  invariants, billing / allocation / refund flows, reports, voting, water. Each suite is
  `describe.skipIf(!process.env.DATABASE_URL_TEST)`, so it no-ops unless you point
  `DATABASE_URL_TEST` at a throwaway database (`npm run test:integration`).
  - No local Postgres? `npm run test:integration:probe` runs the whole suite against a
    disposable `ci_probe_*` **schema** on the Supabase project in `.env` (Prisma binds the
    client to `?schema=`, so `public` is never touched) and drops it after. Pass a filter:
    `npm run test:integration:probe votes`.

CI (`.github/workflows/ci.yml`) runs three jobs on every push / PR and blocks on all of
them: **check** (typecheck + lint + unit tests), **integration** (a `postgres:16` service
+ `prisma migrate deploy` + the integration suite), and **build** (`next build`).

## Deployment

**App** on Vercel, **Postgres + Auth + Storage** on Supabase. Full runbook —
connection strings, the env-var table, storage-bucket provisioning, Supabase Auth
URLs, cron wiring, migrations, and the secret-rotation procedure — is in
[`DEPLOYMENT.md`](DEPLOYMENT.md). Pre-launch checklist: [`GO-LIVE.md`](GO-LIVE.md).
Baseline Postgres RLS (enabled, no policies — closes the PostgREST/anon-key exposure) is
live; tenant isolation is still app-layer + org-per-user. The fuller per-org-policy design
is in [`docs/rls-design.md`](docs/rls-design.md).

- **App health**: `GET /api/health` → `{ ok, db, time }` (200 / 503).
- `npm run db:seed` refuses to run when `NODE_ENV=production` or `VERCEL` is set.

## Scripts

| | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm test` / `npm run test:unit` / `npm run test:integration` | vitest suites |
| `npm run test:integration:probe [filter]` | integration suite against a disposable Supabase schema — no Docker |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` (authoring) |
| `npm run db:seed` | reseed the demo HOA (blocked in production) |
| `npm run db:studio` | Prisma Studio |
| `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/provision-storage.ts` | create the 5 Supabase Storage buckets (idempotent — run once per environment) |
| `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/notify-overdue.ts` | overdue-invoice notification sweep (daily cron, or `GET /api/cron/overdue`) |
| `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/apply-late-fees.ts` | late-fee sweep — adds a late-fee invoice to overdue dues (daily cron, or `GET /api/cron/late-fees`) |
| `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/water-reminders.ts` | water-reading reminder — nudges staff of metered HOAs behind on readings/billing (daily cron, or `GET /api/cron/water-reminder`) |
