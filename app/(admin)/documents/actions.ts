"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  uploadDocument,
  deleteDocument,
  isDocumentCategory,
} from "@/lib/documents";

type Result = { ok: true } | { ok: false; error: string };

const metaSchema = z.object({
  title: z.string().trim().min(2, "Give it a title").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().refine(isDocumentCategory, "Pick a category"),
  staffOnly: z.boolean(),
});

function parseMeta(fd: FormData) {
  return metaSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") ?? "",
    category: fd.get("category"),
    staffOnly: fd.get("staffOnly") === "true" || fd.get("staffOnly") === "on",
  });
}

function revalidate() {
  revalidatePath("/documents");
  revalidatePath("/portal/documents");
}

export async function uploadDocumentAction(fd: FormData): Promise<Result> {
  const denied = await denyUnless("document:write");
  if (denied) return denied;

  const parsed = parseMeta(fd);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose a file to upload" };

  const { org, user } = await getCurrentOrgContext();
  const uploaded = await uploadDocument(file, { orgId: org.id });
  if (!uploaded)
    return {
      ok: false,
      error: "That file type isn't supported, or it's over 20 MB",
    };

  const d = parsed.data;
  await prisma.document.create({
    data: {
      orgId: org.id,
      title: d.title,
      description: d.description || null,
      category: d.category as DocumentCategory,
      staffOnly: d.staffOnly,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedById: user.id,
    },
  });

  revalidate();
  await logAudit({
    action: "document.upload",
    target: d.title,
    detail: d.staffOnly ? "staff only" : undefined,
  });
  return { ok: true };
}

export async function updateDocumentAction(
  id: string,
  fd: FormData
): Promise<Result> {
  const denied = await denyUnless("document:write");
  if (denied) return denied;

  const parsed = parseMeta(fd);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const doc = await prisma.document.findFirst({ where: { id, orgId: org.id } });
  if (!doc) return { ok: false, error: "Document not found" };

  const d = parsed.data;
  await prisma.document.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      category: d.category as DocumentCategory,
      staffOnly: d.staffOnly,
    },
  });

  revalidate();
  await logAudit({ action: "document.update", target: d.title });
  return { ok: true };
}

export async function deleteDocumentAction(id: string): Promise<Result> {
  const denied = await denyUnless("document:write");
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const doc = await prisma.document.findFirst({ where: { id, orgId: org.id } });
  if (!doc) return { ok: false, error: "Document not found" };

  await prisma.document.delete({ where: { id } });
  await deleteDocument(doc.storagePath);

  revalidate();
  await logAudit({ action: "document.delete", target: doc.title });
  return { ok: true };
}
