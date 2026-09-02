/**
 * One-off: create the Supabase Storage buckets the app needs.
 * Run once per Supabase project:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/init-storage.ts
 */
import { ensureMarketplaceBucket, MARKETPLACE_BUCKET } from "../lib/storage";
import { ensureDocumentsBucket, DOCUMENTS_BUCKET } from "../lib/documents";
import { ensurePaymentQrBucket, PAYMENT_QR_BUCKET } from "../lib/payment-qr";

(async () => {
  await ensureMarketplaceBucket();
  console.log(`✔ bucket "${MARKETPLACE_BUCKET}" ready (public)`);
  await ensureDocumentsBucket();
  console.log(`✔ bucket "${DOCUMENTS_BUCKET}" ready (private)`);
  await ensurePaymentQrBucket();
  console.log(`✔ bucket "${PAYMENT_QR_BUCKET}" ready (public)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
