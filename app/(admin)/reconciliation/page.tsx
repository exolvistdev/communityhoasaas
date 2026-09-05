import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { peso, periodLabel } from "@/lib/format";
import { ReconciliationActions } from "./ReconciliationActions";

export const metadata = { title: "Reconciliation · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
};

export default async function ReconciliationPage() {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "billing:write");

  const paymentInclude = {
    invoice: {
      include: { property: { select: { id: true, unitNumber: true } } },
    },
    submittedBy: { select: { fullName: true } },
    confirmedBy: { select: { fullName: true } },
  } as const;

  const [pending, recent] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "PENDING",
        invoice: { property: { orgId: org.id } },
      },
      include: paymentInclude,
      orderBy: { paidAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        status: { in: ["CONFIRMED", "REJECTED"] },
        submittedById: { not: null },
        invoice: { property: { orgId: org.id } },
      },
      include: paymentInclude,
      orderBy: { confirmedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-fg">Reconciliation</h1>
        <p className="text-sm text-fg-muted">
          Payments homeowners submitted from the portal, awaiting your
          confirmation.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing to reconcile. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Method / ref</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-4 py-2.5 font-medium text-fg">
                    {p.invoice.property.unitNumber}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {p.invoice.period ? periodLabel(p.invoice.period) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {peso(Number(p.amount))}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.note ? (
                      <div className="text-xs text-fg-subtle">{p.note}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {fmt(p.paidAt)}
                    {p.submittedBy ? (
                      <div className="text-xs text-fg-subtle">
                        {p.submittedBy.fullName}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite ? (
                      <ReconciliationActions id={p.id} />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">
            Recently processed
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 font-medium text-fg">
                      {p.invoice.property.unitNumber}
                    </td>
                    <td className="px-4 py-2 text-right text-fg-muted">
                      {peso(Number(p.amount))}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">
                      {METHOD_LABEL[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      {p.status === "CONFIRMED" ? (
                        <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
                          Confirmed
                        </span>
                      ) : (
                        <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-fg">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-fg-subtle">
                      {p.confirmedAt ? fmt(p.confirmedAt) : ""}
                      {p.confirmedBy ? ` · ${p.confirmedBy.fullName}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
