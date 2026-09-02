import { randomUUID } from "crypto";
import type { DocumentCategory } from "@prisma/client";
import { createAdminClient } from "./supabase/admin";

/**
 * Private Storage bucket for HOA documents (bylaws, minutes, financials, forms).
 * Unlike the marketplace bucket this is NOT public — objects are served through
 * `app/documents/[id]/route.ts`, which re-checks the caller and hands back a
 * short-lived signed URL.
 */
export const DOCUMENTS_BUCKET = "documents";

const MAX_BYTES = 20 * 1024 * 1024;

/** Accepted upload types → file extension. */
const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export const DOCUMENT_MAX_BYTES = MAX_BYTES;
export const DOCUMENT_ACCEPT = Object.keys(MIME_EXT).join(",");

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "BYLAWS", label: "Bylaws & governing docs" },
  { value: "BOARD_MINUTES", label: "Board meeting minutes" },
  { value: "FINANCIAL_STATEMENT", label: "Financial statements" },
  { value: "FORM", label: "Forms" },
  { value: "POLICY", label: "Policies & guidelines" },
  { value: "NEWSLETTER", label: "Newsletters" },
  { value: "OTHER", label: "Other" },
];

export const CATEGORY_LABEL: Record<DocumentCategory, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label])
) as Record<DocumentCategory, string>;

export function isDocumentCategory(v: unknown): v is DocumentCategory {
  return typeof v === "string" && v in CATEGORY_LABEL;
}

/** Idempotently create the private documents bucket. Ops / seed only. */
export async function ensureDocumentsBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(DOCUMENTS_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXT),
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export type UploadedDocument = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Upload one document via the service-role client (bypasses Storage RLS).
 * Returns null when the file is missing, too big, or an unsupported type.
 */
export async function uploadDocument(
  file: File | null | undefined,
  opts: { orgId: string }
): Promise<UploadedDocument | null> {
  if (!file || file.size === 0 || file.size > MAX_BYTES || !MIME_EXT[file.type])
    return null;

  const ext = MIME_EXT[file.type];
  const storagePath = `${opts.orgId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await createAdminClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, buf, { contentType: file.type, upsert: false });
  if (error) return null;

  return {
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

/** Best-effort removal — a leftover object is harmless, a thrown error isn't. */
export async function deleteDocument(path: string) {
  try {
    await createAdminClient().storage.from(DOCUMENTS_BUCKET).remove([path]);
  } catch {
    /* ignore */
  }
}

/** Short-lived signed URL for a stored document (default 60s). */
export async function documentSignedUrl(path: string, expiresIn = 60) {
  const { data } = await createAdminClient()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Best-effort: drop every object stored under an org's folder (seed reset). */
export async function clearOrgDocuments(orgId: string) {
  try {
    const storage = createAdminClient().storage.from(DOCUMENTS_BUCKET);
    const { data: files } = await storage.list(orgId);
    const paths = (files ?? []).map((f) => `${orgId}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  } catch {
    /* best effort */
  }
}

/** "1.2 MB" style size label. */
export function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
