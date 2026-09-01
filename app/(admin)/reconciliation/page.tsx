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
        <h1 className="text-lg font-semibold text-gray-900">Reconciliation</h1>
        <p className="text-sm text-gray-500">
          Payments homeowners submitted from the portal, awaiting your
          confirmation.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Nothing to reconcile. 🎉
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
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
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {p.invoice.property.unitNumber}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {p.invoice.period ? periodLabel(p.invoice.period) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {peso(Number(p.amount))}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                    {p.note ? (
                      <div className="text-xs text-gray-400">{p.note}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {fmt(p.paidAt)}
                    {p.submittedBy ? (
                      <div className="text-xs text-gray-400">
                        {p.submittedBy.fullName}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite ? (
                      <ReconciliationActions id={p.id} />
                    ) : (
                      <span className="text-gray-400">—</span>
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
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Recently processed
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {p.invoice.property.unitNumber}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {peso(Number(p.amount))}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {METHOD_LABEL[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      {p.status === "CONFIRMED" ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Confirmed
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-400">
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
