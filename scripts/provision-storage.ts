/**
 * Create the Supabase Storage buckets the app expects. Idempotent — each
 * `ensure*Bucket` no-ops if the bucket already exists. Run once per environment
 * (the demo seed does this automatically; production needs it run by hand):
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/provision-storage.ts
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 */
import { ensureMarketplaceBucket } from "../lib/storage";
import { ensureDocumentsBucket } from "../lib/documents";
import { ensurePaymentQrBucket } from "../lib/payment-qr";
import { ensureViolationPhotosBucket } from "../lib/violation-photos";
import { ensureMaintenanceBucket } from "../lib/maintenance-photos";

const steps: [string, () => Promise<unknown>][] = [
  ["marketplace", ensureMarketplaceBucket],
  ["documents", ensureDocumentsBucket],
  ["payment-qr", ensurePaymentQrBucket],
  ["violations", ensureViolationPhotosBucket],
  ["maintenance", ensureMaintenanceBucket],
];

for (const [name, fn] of steps) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (e) {
    console.error(`x ${name} - ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
