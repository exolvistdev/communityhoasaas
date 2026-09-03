import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { VendorsManager } from "./VendorsManager";

export const metadata = { title: "Vendors · HOA SaaS" };

export default async function VendorsPage() {
  const { org } = await requirePermission("vendor:manage");

  const vendors = await prisma.vendor.findMany({
    where: { orgId: org.id },
    include: {
      bills: {
        where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
        select: {
          amount: true,
          payments: { select: { amount: true } },
        },
      },
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
  });

  const rows = vendors.map((v) => {
    const owed = v.bills.reduce((s, b) => {
      const paid = b.payments.reduce((a, p) => a + Number(p.amount), 0);
      return s + Math.max(Number(b.amount) - paid, 0);
    }, 0);
    return { v, owed, openBills: v.bills.length };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">Vendors</h1>
          <p className="text-sm text-fg-muted">
            Suppliers and service providers you record bills against.
          </p>
        </div>
        <Link
          href="/bills"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          Bills →
        </Link>
      </div>

      <VendorsManager
        vendors={rows.map(({ v, owed, openBills }) => ({
          id: v.id,
          name: v.name,
          contactName: v.contactName,
          email: v.email,
          phone: v.phone,
          notes: v.notes,
          archived: Boolean(v.archivedAt),
          owed,
          openBills,
        }))}
      />

      <p className="text-xs text-fg-subtle">
        {rows.reduce((s, r) => s + r.owed, 0) > 0
          ? `Total outstanding to vendors: ${peso(
              rows.reduce((s, r) => s + r.owed, 0)
            )}`
          : "No outstanding vendor bills."}
      </p>
    </div>
  );
}
