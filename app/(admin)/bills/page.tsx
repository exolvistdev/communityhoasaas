import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { billStatus, BILL_STATUS_BADGE, effectiveBillStatus } from "@/lib/bill";
import { AddBillForm } from "./AddBillForm";

export const metadata = { title: "Bills · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export default async function BillsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const { org } = await requirePermission("vendor:manage");
  const filter = searchParams.filter === "all" ? "all" : "open";

  const [bills, vendors, expenseAccounts] = await Promise.all([
    prisma.bill.findMany({
      where: {
        orgId: org.id,
        ...(filter === "open" ? { status: { in: ["UNPAID", "PARTIALLY_PAID"] } } : {}),
      },
      include: {
        vendor: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ dueDate: "asc" }, { billDate: "desc" }],
    }),
    prisma.vendor.findMany({
      where: { orgId: org.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { orgId: org.id, type: "EXPENSE" },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const now = Date.now();
  const rows = bills.map((b) => {
    const paid = b.payments.reduce((a, p) => a + Number(p.amount), 0);
    const outstanding =
      b.status === "VOID" ? 0 : Math.max(Number(b.amount) - paid, 0);
    const display =
      b.status === "VOID"
        ? "VOID"
        : effectiveBillStatus({
            status: billStatus(Number(b.amount), paid),
            dueDate: b.dueDate,
          });
    return { b, outstanding, display };
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdue = rows.filter(
    (r) => r.display === "OVERDUE"
  ).length;
  const dueSoon = rows.filter(
    (r) =>
      (r.display === "UNPAID" || r.display === "PARTIALLY_PAID") &&
      r.b.dueDate.getTime() >= now &&
      r.b.dueDate.getTime() < now + 7 * 86_400_000
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Bills</h1>
          <p className="text-sm text-fg-muted">
            Vendor invoices — recording one books the expense and an account
            payable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/vendors"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            Vendors
          </Link>
          <AddBillForm vendors={vendors} expenseAccounts={expenseAccounts} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Outstanding" value={peso(totalOutstanding)} tone={totalOutstanding > 0 ? "warning" : "neutral"} />
        <Summary label="Overdue" value={String(overdue)} tone={overdue > 0 ? "danger" : "neutral"} />
        <Summary label="Due within 7 days" value={String(dueSoon)} />
      </div>

      <div className="flex gap-2">
        <Pill href="/bills" active={filter === "open"}>
          Open ({filter === "open" ? rows.length : "…"})
        </Pill>
        <Pill href="/bills?filter=all" active={filter === "all"}>
          All
        </Pill>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          {filter === "open" ? "No open bills. 🎉" : "No bills recorded yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Vendor / description</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, outstanding, display }) => {
                const badge = BILL_STATUS_BADGE[display];
                return (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/bills/${b.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        {b.vendor.name}
                      </Link>
                      <div className="text-xs text-fg-subtle">{b.description}</div>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {fmtDate(b.dueDate)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {peso(Number(b.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-fg-muted">
                      {outstanding > 0.005 ? peso(outstanding) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
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

function Summary({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const t = {
    neutral: "text-fg",
    warning: "text-warning-fg",
    danger: "text-danger-fg",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-sm text-fg-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${t}`}>{value}</div>
    </div>
  );
}

function Pill({
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
