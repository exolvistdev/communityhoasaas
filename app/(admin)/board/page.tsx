import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { boardRoster } from "@/lib/board";
import { BoardManager } from "./BoardManager";
import { PastTrustees } from "./PastTrustees";
import { AppointForm } from "./AppointForm";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Board of Trustees · HOA SaaS" };

export default async function BoardPage() {
  const { org } = await requirePermission("election:manage");

  const [{ current, past }, homeowners] = await Promise.all([
    boardRoster(org.id),
    prisma.homeowner.findMany({
      where: { property: { orgId: org.id, archivedAt: null }, isPrimary: true },
      select: {
        id: true,
        fullName: true,
        property: { select: { unitNumber: true } },
      },
      orderBy: { property: { unitNumber: "asc" } },
    }),
  ]);

  const pool = homeowners.map((h) => ({
    id: h.id,
    label: `${h.fullName} · ${h.property.unitNumber}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board of Trustees"
        description="The seated board and its officers. Elected trustees come from finalizing an election; you can also appoint one."
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">
          Current board <span className="text-fg-subtle">({current.length})</span>
        </h2>
        {current.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No seated trustees. Finalize an election or appoint one below.
          </p>
        ) : (
          <BoardManager trustees={current} />
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Past trustees</h2>
          <PastTrustees trustees={past} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Appoint a trustee</h2>
        <AppointForm pool={pool} />
      </section>
    </div>
  );
}
