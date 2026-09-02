/**
 * Overdue-invoice notification sweep (all orgs). Run from cron / manually:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/notify-overdue.ts
 * Deduped: at most one INVOICE_OVERDUE per homeowner / 25 days.
 */
import { generateOverdueNotifications } from "../lib/notifications";

generateOverdueNotifications()
  .then(({ sent }) => console.log(`✔ overdue sweep — ${sent} notification(s) sent`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
