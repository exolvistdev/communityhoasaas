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
| Properties — list, detail, people (owner/co-owner/renter), rate plans, archive | ✅ |
| Billing — bulk invoice generation, record payment, void, Statement of Account (single + bulk + CSV) | ✅ |
| Reconciliation — confirm/reject homeowner-submitted payments | ✅ |
| Ledger — trial balance, journal, chart of accounts, CSV export | ✅ |
| Gate passes — create / list / revoke, scannable code | ✅ |
| Announcements — draft / publish | ✅ |
| Team — invite staff/guard by email, role management | ✅ |
| Settings — HOA name, billing due-day, rate plans, GCash/Maya payment details | ✅ |
| RBAC — ADMIN / TREASURER / BOARD_MEMBER / GUARD / HOMEOWNER | ✅ |
| Password recovery (self-service + admin reset-link fallback), `/account` self-service profile/password/contact | ✅ |
| Gate activity log + admin audit trail (`/gate-passes?view=activity`, `/audit`) | ✅ |
| Homeowner portal (§4.4) — balance + breakdown, payment history w/ pending/rejected status, Pay Now, own statement, gate-pass request (QR), announcements | ✅ |
| Guard portal (§4.5) — QR camera scan or manual code, valid/expired/revoked/used verdict + scan log | ✅ |
| Visitor pass page `/pass/<code>` — public QR + validity for the visitor to show at the gate | ✅ |
| Platform operator console `/platform` — cross-tenant org directory + full user impersonation for support | ✅ |
| Resident marketplace (Phase 2) — listings with photos, buyer-seller message threads, admin moderation | ✅ |
| Amenity booking (Phase 2) — bookable amenities, time-slot reservations, staff approval, invoiced fees | ✅ |
| Notifications — in-app center (bell + `/notifications`) and email for billing, announcements, amenities, marketplace, with a per-user preferences panel in `/account` | ✅ |

Payments: no PayMongo. Homeowners pay via GCash/Maya (QR + details shown in the
portal) and submit the reference; an admin confirms it in **Reconciliation**,
which posts it to the ledger.

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
SUPABASE_SERVICE_ROLE_KEY="…"                        # invites, seed auth users, marketplace photo uploads
RESEND_API_KEY=""                                    # optional — email notifications no-op without it (in-app center still works)
EMAIL_FROM="HOA SaaS <onboarding@resend.dev>"        # sender for notification emails
CRON_SECRET=""                                       # optional — gates GET /api/cron/overdue (daily overdue-invoice sweep)
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
node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/init-storage.ts  # once per Supabase project — creates the marketplace Storage bucket
npm run db:seed             # demo HOA "sample-hoa" (also ensures the bucket)
npm run dev
```

### Seed logins

All use password `demo-password-123`:

| Role | Email |
| --- | --- |
| Admin | `admin@sample-hoa.ph` |
| Treasurer | `treasurer@sample-hoa.ph` |
| Board member | `board@sample-hoa.ph` |
| Guard | `guard@sample-hoa.ph` |
| Homeowner | `juan@example.com` |
| Homeowner | `ana@example.com` |
| Platform operator | `superadmin@hoasaas.ph` (sign in at `/platform/login`) |

## Project layout

```
app/
  (admin)/            staff app — dashboard, properties, billing, reconciliation,
                      ledger, gate-passes, announcements, team, settings
  onboarding/         org + admin sign-up wizard
  statements/         printable Statement of Account (kept outside the sidebar chrome)
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
  init-storage.ts     one-off: create the "marketplace" Storage bucket
```

## Deployment

- **App**: Vercel (or any Node host). Set all `.env` vars in the host.
- **DB / Auth**: Supabase. Run `npx prisma migrate deploy` against the production
  database on each release.
- Set the Supabase Auth **Site URL** / redirect allow-list to the deployed
  domain so invite links resolve.

## Scripts

| | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm run db:migrate` | `prisma migrate dev` (authoring) |
| `npm run db:seed` | reseed the demo HOA |
| `npm run db:studio` | Prisma Studio |
| `node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/notify-overdue.ts` | overdue-invoice notification sweep (wire to a daily cron, or hit `GET /api/cron/overdue`) |
