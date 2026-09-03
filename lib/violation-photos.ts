import { randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";

/**
 * Private Storage bucket for violation evidence photos. Not public — served
 * through `app/violation-photos/[id]/route.ts`, which re-checks the caller
 * (staff, or a resident of the cited unit) and hands back a signed URL.
 */
export const VIOLATION_PHOTOS_BUCKET = "violations";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 8;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Idempotently create the private violations bucket. Ops / seed only. */
export async function ensureViolationPhotosBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(VIOLATION_PHOTOS_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(VIOLATION_PHOTOS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXT),
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/**
 * Upload violation photos via the service-role client. Silently drops files
 * that aren't a supported image or exceed the size cap; never more than
 * MAX_PHOTOS. Returns the stored object paths.
 */
export async function uploadViolationPhotos(
  files: File[],
  opts: { orgId: string; violationId: string }
): Promise<string[]> {
  const usable = files
    .filter((f) => f && f.size > 0 && f.size <= MAX_BYTES && MIME_EXT[f.type])
    .slice(0, MAX_PHOTOS);
  if (usable.length === 0) return [];

  const admin = createAdminClient();
  const paths: string[] = [];
  for (const file of usable) {
    const ext = MIME_EXT[file.type];
    const path = `${opts.orgId}/${opts.violationId}/${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from(VIOLATION_PHOTOS_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: false });
    if (!error) paths.push(path);
  }
  return paths;
}

/** Short-lived signed URL for a stored photo (default 60s). */
export async function violationPhotoSignedUrl(path: string, expiresIn = 60) {
  const { data } = await createAdminClient()
    .storage.from(VIOLATION_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Best-effort removal — a leftover object is harmless, a thrown error isn't. */
export async function deleteViolationPhotos(paths: string[]) {
  if (paths.length === 0) return;
  try {
    await createAdminClient().storage.from(VIOLATION_PHOTOS_BUCKET).remove(paths);
  } catch {
    /* ignore */
  }
}

/** Best-effort: drop every photo stored under an org's folder (seed reset). */
export async function clearOrgViolationPhotos(orgId: string) {
  try {
    const storage = createAdminClient().storage.from(VIOLATION_PHOTOS_BUCKET);
    const { data: folders } = await storage.list(orgId);
    for (const f of folders ?? []) {
      const { data: files } = await storage.list(`${orgId}/${f.name}`);
      const paths = (files ?? []).map((x) => `${orgId}/${f.name}/${x.name}`);
      if (paths.length) await storage.remove(paths);
    }
  } catch {
    /* best effort */
  }
}
