import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { billStatus, BILL_STATUS_BADGE, effectiveBillStatus } from "@/lib/bill";
import { BillActions } from "./BillActions";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({ params }: { params: { id: string } }) {
  const b = await prisma.bill.findUnique({
    where: { id: params.id },
    select: { vendor: { select: { name: true } } },
  });
  return { title: b ? `Bill · ${b.vendor.name}` : "Bill · HOA SaaS" };
}

export default async function BillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("vendor:manage");

  const bill = await prisma.bill.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      vendor: { select: { id: true, name: true } },
      payments: {
        orderBy: { paidAt: "asc" },
        include: { recordedBy: { select: { fullName: true } } },
      },
      createdBy: { select: { fullName: true } },
    },
  });
  if (!bill) notFound();

  const account = await prisma.account.findFirst({
    where: { orgId: org.id, code: bill.expenseAccountCode },
    select: { name: true },
  });

  const paid = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.round((Number(bill.amount) - paid) * 100) / 100;
  const display =
    bill.status === "VOID"
      ? "VOID"
      : effectiveBillStatus({
          status: billStatus(Number(bill.amount), paid),
          dueDate: bill.dueDate,
        });
  const badge = BILL_STATUS_BADGE[display];

  return (
    <div className="space-y-6">
      <Link href="/bills" className="text-sm text-fg-muted hover:text-fg">
        ← Bills
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {bill.description}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </h1>
          <div className="text-sm text-fg-muted">
            <Link
              href={`/vendors/${bill.vendor.id}`}
              className="underline underline-offset-2 hover:text-fg"
            >
              {bill.vendor.name}
            </Link>
            {bill.billNumber ? ` · #${bill.billNumber}` : ""} · billed{" "}
            {fmtDate(bill.billDate)} · due {fmtDate(bill.dueDate)}
          </div>
          <div className="text-xs text-fg-subtle">
            {bill.expenseAccountCode} · {account?.name ?? "Expense"}
            {bill.createdBy ? ` · recorded by ${bill.createdBy.fullName}` : ""}
          </div>
          {bill.status === "VOID" && bill.voidReason && (
            <p className="text-xs text-danger-fg">Voided: {bill.voidReason}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-fg-muted">Amount</div>
          <div className="text-lg font-semibold text-fg">
            {peso(Number(bill.amount))}
          </div>
          {bill.status !== "VOID" && remaining > 0.005 && (
            <div className="text-xs text-warning-fg">{peso(remaining)} unpaid</div>
          )}
        </div>
      </div>

      {bill.payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Payments</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {bill.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg-muted">
                      {fmtDate(p.paidAt)}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">
                      {p.method.replace("_", " ").toLowerCase()}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {peso(Number(p.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {bill.status !== "VOID" && (
        <BillActions
          billId={bill.id}
          remaining={remaining}
          canVoid={bill.payments.length === 0}
        />
      )}
    </div>
  );
}
