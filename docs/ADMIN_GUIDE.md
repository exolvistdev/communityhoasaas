# HOA SaaS — Admin Guide

A short walkthrough of the staff app. Sign in at `/login`; you land on the
dashboard (staff), the guard portal, or the homeowner portal depending on your
role.

## Roles & permissions

| | Admin | Treasurer | Board member |
| --- | :-: | :-: | :-: |
| View everything | ✓ | ✓ | ✓ |
| Generate invoices, record & confirm payments | ✓ | ✓ | — |
| Add / edit properties & people, gate passes | ✓ | ✓ | — |
| Post announcements | ✓ | ✓ | ✓ |
| Settings, Team | ✓ | — | — |

**Guard** and **Homeowner** accounts never see the staff app — they get their
own portals.

## 1. Onboarding

`/onboarding` (first run only): enter the HOA name, a subdomain, and the admin's
name / email / password. Then **import your property roll** as a CSV — columns
`unit number`, `type` (residential / commercial / townhouse), `monthly rate`,
and optionally `homeowner name`, `email`, `phone`. Duplicate units are skipped.

You can re-import or bulk-add later from **Properties → Import CSV**.

## 2. Properties

- **Properties** lists active units. Click a unit for its detail page.
- **Detail page**: edit unit / type / rate (pick a rate plan or a custom
  amount), manage **people** (Owner / Co-owner / Renter, one primary contact),
  see the unit's invoices and gate passes, and its current balance.
- **Invite to portal**: on a person with an email, click *Invite to portal* — a
  link is generated; send it to them to set a password and access the homeowner
  portal.
- **Archive property**: when a unit is sold or vacated. It stops being billed and
  drops off the active list (toggle *Show archived* to see it); all history and
  any outstanding balance are kept. Restore from the same button.

## 3. Rate plans (Settings)

Named dues tiers (e.g. "Standard Residential", "Corner lot"). Assign a plan to a
property and its monthly rate follows the plan. Changing a plan's rate does **not**
touch existing properties until you click **re-apply** (so past billing isn't
rewritten). Deleting a plan leaves its properties on a custom rate.

## 4. Billing

- **Generate monthly invoices**: creates one invoice per active property for the
  current period at its configured rate, after a confirmation showing the count
  and total. It's idempotent — running it again only bills properties that
  don't yet have an invoice for the period.
- **Record payment**: for cash / check / bank transfer you received directly —
  posts immediately.
- **Void**: cancels a wrong invoice with a reason and posts a reversing ledger
  entry. Blocked if the invoice has a confirmed or pending payment (handle that
  first). After voiding, that month can be regenerated.
- **Statements**: printable Statement of Account per property (single or bulk,
  plus CSV) via the **Statements** button and the *View SOA* row action.
- Due day is set in **Settings → Invoice due day**.

## 5. Reconciliation

Homeowners who pay by GCash / Maya submit the amount + reference from the portal;
those land here as **pending**. They don't affect any balance until you
**Confirm** (which posts to the ledger) or **Reject** (with a reason). The
Billing page shows a banner when payments are waiting.

Set your GCash / Maya account details and cash / bank instructions in
**Settings → Payments** — these are what the homeowner sees on the Pay Now
screen.

## 6. Ledger

Read-only audit view.

- **Trial balance** — per-account debit/credit totals; must show "debits equal
  credits".
- **Journal** — every entry and its lines, filterable by date range and account,
  with CSV export.
- **Chart of accounts** — the standard accounts (Cash, A/R — Dues, HOA Dues
  Income).

## 7. Gate passes

Create a pass for a visitor (property, name, validity window) — a short code is
generated to share with them. List / filter / revoke. Homeowners can also create
passes for their own unit from the portal.

Every pass has a shareable page at `/pass/<code>` showing a QR + the code +
validity — the homeowner/admin sends that link to the visitor, who shows it at
the gate.

**Guard portal** (`/guard`, guard accounts only): the guard **scans the visitor's
QR** (camera) or types the code, and gets a big **Valid / Expired / Not-yet-valid
/ Revoked / No-match** verdict with the visitor name, unit, and window, plus a
list of their recent checks. Every check is logged.

## 8. Announcements

Write, save as draft, and publish. Published announcements appear in the
homeowner portal. Board members can post here too.

## 9. Team

**Settings → Team** (admin only): invite a Treasurer, Board member, or Guard by
email and role. An invite link is shown to copy and send. Change a member's role
or remove them; the last admin can't be removed or demoted.

## 10. Settings (admin)

HOA name, invoice due day, rate plans, and payment details (GCash / Maya / bank /
cash instructions).

## What homeowners see

A homeowner you've invited (from a property's People section) signs in and gets
`/portal` — a mobile-friendly view of **their unit only**:

- **Balance card** — amount due and next due date, with an overdue (red) or
  paid-up (green) treatment; a "Pay now" button when they owe.
- **Pay now** — shows your GCash / Maya details (from Settings → Payments); the
  homeowner pays in their own app and submits the amount + reference, which lands
  in **Reconciliation** as a pending payment for you to confirm. Cash / bank
  shows your written instructions only. Submitted payments show in their history
  as **Awaiting confirmation**, then **Paid** or **Rejected** (with your reason).
- **View statement** — the homeowner can open/print their own Statement of Account
  (only their unit).
- **Gate pass** — the homeowner can register their own visitors and share the
  `/pass/<code>` QR link; these also appear in the admin Gate passes list.
- **Announcements** — your published announcements.
- **Payment history** — their confirmed payments.

Guards and homeowners never see the staff app.
