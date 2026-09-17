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
import { PageHeader } from "@/components/PageHeader";
import { NavPill, NavPills } from "@/components/ui/nav-pill";
import { VoidInvoiceButton } from "./VoidInvoiceButton";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

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

  const columns: ResponsiveColumn<(typeof rows)[number]>[] = [
    {
      key: "unit",
      header: "Unit",
      card: "title",
      className: "font-medium text-fg",
      cell: ({ inv }) => inv.property.unitNumber,
    },
    {
      key: "period",
      header: "Period",
      className: "text-fg-muted",
      cell: ({ inv }) => inv.period ?? "—",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: ({ inv }) => peso(Number(inv.amount)),
    },
    {
      key: "dueDate",
      header: "Due date",
      className: "text-fg-muted",
      cell: ({ inv }) =>
        inv.dueDate.toLocaleDateString("en-PH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: ({ display }) => <InvoiceStatusBadge status={display} />,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      card: "action",
      cell: ({ inv, outstanding, display }) =>
        display === "PAID" || display === "VOID" ? (
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
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description={`Current period: ${periodLabel(period)}`}
        action={
          <>
            <StatementsButton />
            {canWrite && <GenerateInvoicesButton period={period} />}
          </>
        }
      />

      {pendingCount > 0 && (
        <Link
          href="/reconciliation"
          className="block rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-fg hover:bg-warning-subtle"
        >
          {pendingCount} payment{pendingCount === 1 ? "" : "s"} awaiting
          confirmation → Reconciliation
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Total billed" value={peso(totalBilled)} />
        <Summary label="Collected" value={peso(totalCollected)} tone="success" />
        <Summary
          label="Outstanding"
          value={peso(outstanding)}
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
      </div>

      <NavPills>
        <NavPill href="/billing" active={filter === "all"}>
          All ({rows.length})
        </NavPill>
        <NavPill href="/billing?filter=overdue" active={filter === "overdue"}>
          Overdue ({rows.filter((r) => r.display === "OVERDUE").length})
        </NavPill>
      </NavPills>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No invoices yet. Use “Generate monthly invoices” to bill every property
          for {periodLabel(period)}.
        </div>
      ) : (
        <ResponsiveTable
          columns={columns}
          rows={visible}
          rowKey={({ inv }) => inv.id}
          empty={
            <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
              Nothing overdue. 🎉
            </div>
          }
        />
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
