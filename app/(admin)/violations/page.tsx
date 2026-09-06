import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import {
  VIOLATION_CATEGORY_LABEL,
  VIOLATION_STATUS_BADGE,
} from "@/lib/violation";
import { PageHeader } from "@/components/PageHeader";
import { LogViolationForm } from "./LogViolationForm";

export const metadata = { title: "Violations · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

const ORDER = ["OPEN", "APPEALED", "CURED", "DISMISSED"] as const;

export default async function ViolationsPage() {
  const { org } = await requirePermission("violation:manage");

  const [violations, properties] = await Promise.all([
    prisma.violation.findMany({
      where: { orgId: org.id },
      include: {
        property: { select: { unitNumber: true } },
        fineNotices: {
          select: {
            amount: true,
            invoice: {
              select: {
                status: true,
                amount: true,
                allocations: {
                  where: { payment: { status: "CONFIRMED" } },
                  select: { amount: true },
                },
                creditApplications: { select: { amount: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.property.findMany({
      where: { orgId: org.id, archivedAt: null },
      select: { id: true, unitNumber: true },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  const rows = violations
    .map((v) => {
      const outstanding = v.fineNotices.reduce((s, fn) => {
        const inv = fn.invoice;
        if (!inv || inv.status === "VOID") return s;
        const paid =
          inv.allocations.reduce((a, x) => a + Number(x.amount), 0) +
          inv.creditApplications.reduce((a, x) => a + Number(x.amount), 0);
        return s + Math.max(Number(inv.amount) - paid, 0);
      }, 0);
      return { v, outstanding, fineCount: v.fineNotices.length };
    })
    .sort((a, b) => ORDER.indexOf(a.v.status) - ORDER.indexOf(b.v.status));

  const openCount = rows.filter(
    (r) => r.v.status === "OPEN" || r.v.status === "APPEALED"
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            Violations{" "}
            <span className="text-fg-subtle">({openCount} open)</span>
          </>
        }
        description="Log a rule violation, track it to resolution, and serve a fine if needed."
        action={<LogViolationForm properties={properties} />}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No violations logged. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Occurred</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Fines outstanding
                </th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, outstanding, fineCount }) => {
                const badge = VIOLATION_STATUS_BADGE[v.status];
                return (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-fg">
                      {v.property.unitNumber}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {VIOLATION_CATEGORY_LABEL[v.category]}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {fmtDate(v.occurredAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-fg-muted">
                      {fineCount === 0
                        ? "—"
                        : outstanding > 0.005
                        ? peso(outstanding)
                        : "Paid"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/violations/${v.id}`}
                        className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
