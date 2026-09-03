import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { peso, periodLabel, currentPeriod } from "@/lib/format";
import { effectiveStatus, invoicePaid } from "@/lib/invoice";
import { can } from "@/lib/permissions";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { GenerateInvoicesButton } from "./GenerateInvoicesButton";
import { RecordPaymentButton } from "./RecordPaymentButton";
import { StatementsButton } from "./StatementsButton";
import { VoidInvoiceButton } from "./VoidInvoiceButton";

export const metadata = { title: "Billing · HOA SaaS" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "billing:write");
  const period = currentPeriod();
  const filter = searchParams.filter === "overdue" ? "overdue" : "all";

  const [invoices, pendingCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { property: { orgId: org.id } },
      include: {
        property: true,
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
      orderBy: [{ dueDate: "desc" }, { property: { unitNumber: "asc" } }],
    }),
    prisma.payment.count({
      where: { status: "PENDING", invoice: { property: { orgId: org.id } } },
    }),
  ]);

  const rows = invoices.map((inv) => {
    const paid = invoicePaid(inv);
    return {
      inv,
      paid,
      outstanding: Number(inv.amount) - paid,
      display: effectiveStatus(inv),
    };
  });

  const totalBilled = rows.reduce((s, r) => s + Number(r.inv.amount), 0);
  const totalCollected = rows.reduce((s, r) => s + r.paid, 0);
  const outstanding = totalBilled - totalCollected;

  const visible =
    filter === "overdue" ? rows.filter((r) => r.display === "OVERDUE") : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Billing</h1>
          <p className="text-sm text-fg-muted">
            Current period: {periodLabel(period)}
          </p>
        </div>
        <div className="flex items-start gap-2 text-right">
          <StatementsButton />
          {canWrite && <GenerateInvoicesButton period={period} />}
        </div>
      </div>

      {pendingCount > 0 && (
        <Link
          href="/reconciliation"
          className="block rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-fg hover:bg-warning-subtle"
        >
          {pendingCount} payment{pendingCount === 1 ? "" : "s"} awaiting
          confirmation → Reconciliation
        </Link>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Summary label="Total billed" value={peso(totalBilled)} />
        <Summary label="Collected" value={peso(totalCollected)} tone="success" />
        <Summary
          label="Outstanding"
          value={peso(outstanding)}
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="flex gap-2">
        <FilterPill href="/billing" active={filter === "all"}>
          All ({rows.length})
        </FilterPill>
        <FilterPill href="/billing?filter=overdue" active={filter === "overdue"}>
          Overdue ({rows.filter((r) => r.display === "OVERDUE").length})
        </FilterPill>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No invoices yet. Use “Generate monthly invoices” to bill every property
          for {periodLabel(period)}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Due date</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ inv, outstanding, display }) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-fg">
                    {inv.property.unitNumber}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {inv.period ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {peso(Number(inv.amount))}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {inv.dueDate.toLocaleDateString("en-PH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <InvoiceStatusBadge status={display} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {display === "PAID" || display === "VOID" ? (
                      <Link
                        href={`/statements/${inv.propertyId}`}
                        className="text-sm font-medium text-fg underline underline-offset-2"
                      >
                        View SOA
                      </Link>
                    ) : (
                      <span className="flex items-center justify-end gap-3">
                        {canWrite && (
                          <>
                            <RecordPaymentButton
                              invoiceId={inv.id}
                              outstanding={Number(outstanding.toFixed(2))}
                            />
                            <VoidInvoiceButton invoiceId={inv.id} />
                          </>
                        )}
                        <Link
                          href={`/statements/${inv.propertyId}`}
                          className="text-xs text-fg-subtle underline underline-offset-2"
                        >
                          SOA
                        </Link>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-fg-subtle"
                  >
                    Nothing overdue. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const t = {
    neutral: "text-fg",
    success: "text-success-fg",
    warning: "text-warning-fg",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-sm text-fg-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${t}`}>{value}</div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-brand text-white"
          : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
