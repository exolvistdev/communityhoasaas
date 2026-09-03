/**
 * One-off: create the Supabase Storage buckets the app needs.
 * Run once per Supabase project:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/init-storage.ts
 */
import { ensureMarketplaceBucket, MARKETPLACE_BUCKET } from "../lib/storage";
import { ensureDocumentsBucket, DOCUMENTS_BUCKET } from "../lib/documents";
import { ensurePaymentQrBucket, PAYMENT_QR_BUCKET } from "../lib/payment-qr";
import {
  ensureViolationPhotosBucket,
  VIOLATION_PHOTOS_BUCKET,
} from "../lib/violation-photos";
import {
  ensureMaintenanceBucket,
  MAINTENANCE_BUCKET,
} from "../lib/maintenance-photos";

(async () => {
  await ensureMarketplaceBucket();
  console.log(`✔ bucket "${MARKETPLACE_BUCKET}" ready (public)`);
  await ensureDocumentsBucket();
  console.log(`✔ bucket "${DOCUMENTS_BUCKET}" ready (private)`);
  await ensurePaymentQrBucket();
  console.log(`✔ bucket "${PAYMENT_QR_BUCKET}" ready (public)`);
  await ensureViolationPhotosBucket();
  console.log(`✔ bucket "${VIOLATION_PHOTOS_BUCKET}" ready (private)`);
  await ensureMaintenanceBucket();
  console.log(`✔ bucket "${MAINTENANCE_BUCKET}" ready (private)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
