import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { DOCUMENT_CATEGORIES, CATEGORY_LABEL, fileSizeLabel } from "@/lib/documents";

export const metadata = { title: "Documents · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalDocumentsPage() {
  const { org } = await getHomeownerContext();

  const docs = await prisma.document.findMany({
    where: { orgId: org.id, staffOnly: false },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });

  const groups = DOCUMENT_CATEGORIES.map((c) => ({
    ...c,
    docs: docs.filter((d) => d.category === c.value),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Documents</h1>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          Your HOA hasn&apos;t published any documents yet.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.value} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                {CATEGORY_LABEL[g.value]}
              </h2>
              <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                {g.docs.map((d) => (
                  <li key={d.id} className="border-b border-border last:border-0">
                    <a
                      href={`/documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">
                          {d.title}
                        </span>
                        {d.description && (
                          <span className="mt-0.5 block text-xs text-fg-muted">
                            {d.description}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-fg-subtle">
                          {fileSizeLabel(d.sizeBytes)} · {fmt(d.createdAt)}
                        </span>
                      </span>
                      <Download className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
