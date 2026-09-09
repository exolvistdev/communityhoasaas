import { prisma } from "@/lib/prisma";

/**
 * Map a free-text building / tower name to a Building row for this org,
 * creating one on first use. Trimmed, case-sensitive match on the name
 * (the Settings buildings manager is where typos get merged/renamed).
 * Blank / undefined → null (the property just isn't in a building).
 */
export async function resolveBuildingId(
  orgId: string,
  name: string | null | undefined
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.building.findUnique({
    where: { orgId_name: { orgId, name: trimmed } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.building.create({
    data: { orgId, name: trimmed },
    select: { id: true },
  });
  return created.id;
}
