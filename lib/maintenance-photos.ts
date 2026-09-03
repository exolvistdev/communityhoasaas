import { randomUUID } from "crypto";
import { createAdminClient } from "./supabase/admin";

/**
 * Private Storage bucket for maintenance-request photos. Served through
 * `app/maintenance-files/[id]/route.ts`, which re-checks the caller (staff, or
 * the requester) and returns a short-lived signed URL.
 */
export const MAINTENANCE_BUCKET = "maintenance";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 6;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Idempotently create the private maintenance bucket. Ops / seed only. */
export async function ensureMaintenanceBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(MAINTENANCE_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(MAINTENANCE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXT),
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function uploadMaintenancePhotos(
  files: File[],
  opts: { orgId: string; requestId: string }
): Promise<string[]> {
  const usable = files
    .filter((f) => f && f.size > 0 && f.size <= MAX_BYTES && MIME_EXT[f.type])
    .slice(0, MAX_PHOTOS);
  if (usable.length === 0) return [];

  const admin = createAdminClient();
  const paths: string[] = [];
  for (const file of usable) {
    const ext = MIME_EXT[file.type];
    const path = `${opts.orgId}/${opts.requestId}/${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from(MAINTENANCE_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: false });
    if (!error) paths.push(path);
  }
  return paths;
}

export async function maintenancePhotoSignedUrl(path: string, expiresIn = 60) {
  const { data } = await createAdminClient()
    .storage.from(MAINTENANCE_BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function clearOrgMaintenancePhotos(orgId: string) {
  try {
    const storage = createAdminClient().storage.from(MAINTENANCE_BUCKET);
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
