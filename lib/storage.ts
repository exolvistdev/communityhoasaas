import { randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";
import { MARKETPLACE_BUCKET, MAX_LISTING_PHOTOS } from "./marketplace";

export { MARKETPLACE_BUCKET, publicPhotoUrl, MAX_LISTING_PHOTOS } from "./marketplace";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Idempotently create the public marketplace bucket. Ops / seed only. */
export async function ensureMarketplaceBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(MARKETPLACE_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(MARKETPLACE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXT),
  });
  // Ignore a race where another caller created it first.
  if (error && !/already exists/i.test(error.message)) throw error;
}

/**
 * Upload listing photos via the service-role client (bypasses Storage RLS).
 * Silently drops files that aren't a supported image or exceed the size cap,
 * and never accepts more than MAX_LISTING_PHOTOS. Returns the stored object paths.
 */
export async function uploadListingPhotos(
  files: File[],
  opts: { orgId: string; listingId: string }
): Promise<string[]> {
  const usable = files
    .filter((f) => f && f.size > 0 && f.size <= MAX_BYTES && MIME_EXT[f.type])
    .slice(0, MAX_LISTING_PHOTOS);
  if (usable.length === 0) return [];

  const admin = createAdminClient();
  const paths: string[] = [];
  for (const file of usable) {
    const ext = MIME_EXT[file.type];
    const path = `${opts.orgId}/${opts.listingId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from(MARKETPLACE_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: false });
    if (!error) paths.push(path);
  }
  return paths;
}

/** Best-effort removal — a leftover object is harmless, a thrown error isn't. */
export async function deleteListingPhotos(paths: string[]) {
  if (paths.length === 0) return;
  try {
    await createAdminClient().storage.from(MARKETPLACE_BUCKET).remove(paths);
  } catch {
    /* ignore */
  }
}
