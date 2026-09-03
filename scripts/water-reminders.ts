/**
 * Water-reading reminder sweep (all metered orgs behind on readings/billing).
 * Run from cron / manually:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/water-reminders.ts
 * From ~day 18 of the month, at most one nudge per org per month.
 */
import { sendWaterReminders } from "../lib/water-reminders";

sendWaterReminders()
  .then(({ sent }) => console.log(`✔ water reminders — ${sent} org(s) nudged`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
