import { prisma } from "@/lib/prisma";
import { isDelinquent } from "@/lib/election";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type UnitStanding = {
  monthsBehind: number; // count of past-due monthly dues invoices
  pastDue: number; // ₱ remaining on those invoices
  inGoodStanding: boolean;
};

/**
 * Per-unit voting eligibility for an org, keyed by propertyId (RA 9904).
 * A unit is out of good standing once it's `org.electionArrearsMonths` monthly
 * dues invoices past due. Non-archived units with nothing past due are in good
 * standing; archived units are omitted.
 */
export async function orgUnitStanding(
  orgId: string,
  now: Date = new Date()
): Promise<Map<string, UnitStanding>> {
  const [org, properties, invoices] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { electionArrearsMonths: true },
    }),
    prisma.property.findMany({
      where: { orgId, archivedAt: null },
      select: { id: true },
    }),
    prisma.invoice.findMany({
      where: {
        property: { orgId, archivedAt: null },
        period: { not: null }, // monthly dues only — not fees / water / amenity
        status: { notIn: ["PAID", "VOID"] },
        dueDate: { lt: now },
      },
      select: {
        propertyId: true,
        amount: true,
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
    }),
  ]);

  const threshold = org.electionArrearsMonths;
  const map = new Map<string, UnitStanding>();
  for (const p of properties)
    map.set(p.id, { monthsBehind: 0, pastDue: 0, inGoodStanding: true });

  for (const inv of invoices) {
    const paid =
      inv.allocations.reduce((s, a) => s + Number(a.amount), 0) +
      inv.creditApplications.reduce((s, c) => s + Number(c.amount), 0);
    const remaining = Number(inv.amount) - paid;
    if (remaining <= 0.005) continue;
    const cur = map.get(inv.propertyId);
    if (!cur) continue;
    cur.monthsBehind += 1;
    cur.pastDue = r2(cur.pastDue + remaining);
  }

  for (const s of map.values())
    s.inGoodStanding = !isDelinquent(s.monthsBehind, threshold);

  return map;
}

/** Whether one unit may currently vote / field a candidate. */
export async function unitInGoodStanding(
  orgId: string,
  propertyId: string
): Promise<boolean> {
  const standing = await orgUnitStanding(orgId);
  return standing.get(propertyId)?.inGoodStanding ?? false;
}
