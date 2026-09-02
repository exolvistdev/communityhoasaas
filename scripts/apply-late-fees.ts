/**
 * Late-fee sweep (all orgs with late fees enabled). Run from cron / manually:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/apply-late-fees.ts
 * At most one fee per overdue invoice per calendar month, capped per invoice.
 */
import { applyLateFees } from "../lib/late-fees";

applyLateFees()
  .then(({ applied }) =>
    console.log(`✔ late-fee sweep — ${applied} fee(s) applied`)
  )
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
