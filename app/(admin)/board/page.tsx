import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { boardRoster } from "@/lib/board";
import { TRUSTEE_POSITION_LABEL } from "@/lib/election";
import { BoardManager } from "./BoardManager";
import { AppointForm } from "./AppointForm";

export const metadata = { title: "Board of Trustees · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

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
      <div>
        <h1 className="text-lg font-semibold text-fg">Board of Trustees</h1>
        <p className="text-sm text-fg-muted">
          The seated board and its officers. Elected trustees come from finalizing
          an election; you can also appoint one.
        </p>
      </div>

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
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {past.map((t) => (
                  <tr key={t.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg">{t.name}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {TRUSTEE_POSITION_LABEL[t.position]}
                    </td>
                    <td className="px-4 py-2 text-xs text-fg-subtle">
                      {fmt(t.termStart)} – {fmt(t.termEnd)}
                      {t.endedAt ? ` · ended ${fmt(t.endedAt)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Appoint a trustee</h2>
        <AppointForm pool={pool} />
      </section>
    </div>
  );
}
