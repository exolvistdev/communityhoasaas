import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { billStatus, BILL_STATUS_BADGE, effectiveBillStatus } from "@/lib/bill";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({ params }: { params: { id: string } }) {
  const v = await prisma.vendor.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: v ? `${v.name} · HOA SaaS` : "Vendor · HOA SaaS" };
}

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("vendor:manage");

  const vendor = await prisma.vendor.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      bills: {
        orderBy: { billDate: "desc" },
        include: { payments: { select: { amount: true } } },
      },
    },
  });
  if (!vendor) notFound();

  const owed = vendor.bills.reduce((s, b) => {
    if (b.status === "VOID") return s;
    const paid = b.payments.reduce((a, p) => a + Number(p.amount), 0);
    return s + Math.max(Number(b.amount) - paid, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <Link href="/vendors" className="text-sm text-fg-muted hover:text-fg">
        ← Vendors
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-fg">{vendor.name}</h1>
          <div className="text-sm text-fg-muted">
            {[vendor.contactName, vendor.email, vendor.phone]
              .filter(Boolean)
              .join(" · ") || "No contact details"}
          </div>
          {vendor.notes && (
            <p className="text-xs text-fg-subtle">{vendor.notes}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-fg-muted">Outstanding</div>
          <div
            className={`text-lg font-semibold ${
              owed > 0 ? "text-warning-fg" : "text-fg"
            }`}
          >
            {peso(owed)}
          </div>
          <Link
            href="/bills"
            className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
          >
            Record a bill
          </Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Bills</h2>
        {vendor.bills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
            No bills for this vendor yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Bill</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendor.bills.map((b) => {
                  const paid = b.payments.reduce(
                    (a, p) => a + Number(p.amount),
                    0
                  );
                  const display =
                    b.status === "VOID"
                      ? "VOID"
                      : effectiveBillStatus({
                          status: billStatus(Number(b.amount), paid),
                          dueDate: b.dueDate,
                        });
                  const badge = BILL_STATUS_BADGE[display];
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link
                          href={`/bills/${b.id}`}
                          className="text-fg hover:underline"
                        >
                          {b.description}
                        </Link>
                        {b.billNumber ? (
                          <span className="ml-2 text-xs text-fg-subtle">
                            #{b.billNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-fg-muted">
                        {fmtDate(b.dueDate)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {peso(Number(b.amount))}
                      </td>
                      <td className="px-4 py-2">
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
      </section>
    </div>
  );
}
