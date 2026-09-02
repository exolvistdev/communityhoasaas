import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import { DocumentsManager } from "./DocumentsManager";

export const metadata = { title: "Documents · HOA SaaS" };

export default async function DocumentsPage() {
  const { org, user } = await requireStaff();

  const docs = await prisma.document.findMany({
    where: { orgId: org.id },
    include: { uploadedBy: { select: { fullName: true } } },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });

  return (
    <DocumentsManager
      canWrite={can(user.role, "document:write")}
      categories={DOCUMENT_CATEGORIES}
      items={docs.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        category: d.category,
        fileName: d.fileName,
        sizeBytes: d.sizeBytes,
        staffOnly: d.staffOnly,
        uploadedBy: d.uploadedBy?.fullName ?? null,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
