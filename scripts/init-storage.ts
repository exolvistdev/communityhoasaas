/**
 * One-off: create the Supabase Storage bucket the marketplace needs.
 * Run once per Supabase project:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/init-storage.ts
 */
import { ensureMarketplaceBucket, MARKETPLACE_BUCKET } from "../lib/storage";

ensureMarketplaceBucket()
  .then(() => console.log(`✔ bucket "${MARKETPLACE_BUCKET}" ready (public)`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
