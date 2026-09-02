import { prisma } from "@/lib/prisma";
import { periodLabel } from "@/lib/format";
import { postLateFeeIssued } from "@/lib/ledger";
import { logSystemAudit } from "@/lib/audit";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";
import { computeLateFee } from "@/lib/late-fee-policy";

export { computeLateFee, lateFeeSummary } from "@/lib/late-fee-policy";

/**
 * Sweep overdue dues invoices and post a late-fee invoice for each.
 * Deduped: at most `lateFeeMaxOccurrences` per overdue invoice, and never
 * more than once in the same calendar month. Best-effort per invoice.
 */
export async function applyLateFees(orgId?: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const orgs = await prisma.organization.findMany({
    where: { lateFeeEnabled: true, ...(orgId ? { id: orgId } : {}) },
  });

  let applied = 0;

  for (const org of orgs) {
    const graceCutoff = new Date(
      now.getTime() - org.lateFeeGraceDays * 24 * 60 * 60 * 1000
    );

    const invoices = await prisma.invoice.findMany({
      where: {
        period: { not: null }, // dues invoices only — not amenity or fee invoices
        status: { notIn: ["PAID", "VOID"] },
        dueDate: { lt: graceCutoff },
        property: { orgId: org.id, archivedAt: null },
      },
      include: {
        property: {
          select: {
            id: true,
            unitNumber: true,
            homeowners: {
              where: { userId: { not: null } },
              select: { user: { select: recipientSelect } },
            },
          },
        },
        payments: { where: { status: "CONFIRMED" }, select: { amount: true } },
        lateFeeChildren: { select: { id: true, createdAt: true } },
      },
    });

    for (const inv of invoices) {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const remaining = Number(inv.amount) - paid;
      if (remaining <= 0.005) continue;

      if (inv.lateFeeChildren.length >= org.lateFeeMaxOccurrences) continue;
      if (inv.lateFeeChildren.some((c) => c.createdAt >= monthStart)) continue;

      const fee = computeLateFee(
        { lateFeeType: org.lateFeeType, lateFeeAmount: Number(org.lateFeeAmount) },
        remaining
      );
      if (fee <= 0) continue;

      const label = inv.period ? periodLabel(inv.period) : "dues";

      try {
        const child = await prisma.invoice.create({
          data: {
            propertyId: inv.propertyId,
            amount: fee,
            period: null,
            dueDate: now,
            status: "SENT",
            memo: `Late fee — ${inv.property.unitNumber} ${label}`,
            lateFeeParentId: inv.id,
          },
        });
        await postLateFeeIssued(child.id);

        const users = inv.property.homeowners
          .map((h) => h.user)
          .filter((u): u is Recipient => Boolean(u));
        if (users.length)
          await deliver({
            users,
            type: "LATE_FEE_APPLIED",
            title: `Late fee added — ${inv.property.unitNumber}`,
            body: `A ₱${fee.toLocaleString(
              "en-PH"
            )} late fee was added for your unpaid ${label} dues.`,
            href: "/portal",
          });

        await logSystemAudit(
          org.id,
          "invoice.late_fee",
          `${inv.property.unitNumber} · ${label}`,
          `₱${fee.toLocaleString("en-PH")}`
        );
        applied++;
      } catch (e) {
        console.error("[late-fees]", (e as Error).message);
      }
    }
  }

  return { applied };
}
