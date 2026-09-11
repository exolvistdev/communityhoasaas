import { prisma } from "@/lib/prisma";
import { BILLABLE_PROPERTY_WHERE } from "@/lib/rate";

/**
 * The org's live billable-property count (active, non-parking) — the figure
 * the subscription rate band (lib/pricing.ts) is computed from. Shared by
 * Settings and the platform console so they can't drift on what "billable"
 * means. Server-only (imports the Prisma client) — `lib/rate.ts` stays
 * client-safe for the pure `BILLABLE_PROPERTY_WHERE` filter itself.
 */
export async function billablePropertyCount(orgId: string): Promise<number> {
  return prisma.property.count({ where: { orgId, ...BILLABLE_PROPERTY_WHERE } });
}
