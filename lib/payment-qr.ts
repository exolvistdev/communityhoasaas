import { randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";

/**
 * Public Storage bucket for an HOA's uploaded GCash / Maya "receive money" QR
 * images. Public is fine — a payment QR is meant to be shown to whoever is
 * paying. Rendered directly via `paymentQrUrl()` on the Pay Now screen.
 */
export const PAYMENT_QR_BUCKET = "payment-qr";

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const PAYMENT_QR_ACCEPT = Object.keys(MIME_EXT).join(",");
export const PAYMENT_QR_MAX_BYTES = MAX_BYTES;

export type QrWallet = "gcash" | "maya";

/** Idempotently create the public payment-qr bucket. Ops / seed only. */
export async function ensurePaymentQrBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(PAYMENT_QR_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(PAYMENT_QR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXT),
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/**
 * Upload one wallet QR image via the service-role client. Returns the stored
 * object path, or null when the file is missing / too big / an unsupported type.
 */
export async function uploadPaymentQr(
  file: File | null | undefined,
  opts: { orgId: string; wallet: QrWallet }
): Promise<string | null> {
  if (!file || file.size === 0 || file.size > MAX_BYTES || !MIME_EXT[file.type])
    return null;

  const ext = MIME_EXT[file.type];
  const path = `${opts.orgId}/${opts.wallet}-${randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await createAdminClient()
    .storage.from(PAYMENT_QR_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  return error ? null : path;
}

/** Public URL for a stored QR object. */
export function paymentQrUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PAYMENT_QR_BUCKET}/${path}`;
}

/** Best-effort removal — a leftover object is harmless, a thrown error isn't. */
export async function deletePaymentQr(path: string) {
  try {
    await createAdminClient().storage.from(PAYMENT_QR_BUCKET).remove([path]);
  } catch {
    /* ignore */
  }
}

/** Best-effort: drop every QR object under an org's folder (seed reset). */
export async function clearOrgPaymentQr(orgId: string) {
  try {
    const storage = createAdminClient().storage.from(PAYMENT_QR_BUCKET);
    const { data: files } = await storage.list(orgId);
    const paths = (files ?? []).map((f) => `${orgId}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  } catch {
    /* best effort */
  }
}
