import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { isStaff } from "@/lib/permissions";

/**
 * Whether the signed-in user may view the Statement of Account for `propertyId`.
 * Staff: any property in their org. Homeowner: only their linked unit.
 * Returns the org id when allowed, else null.
 */
export async function statementViewerOrg(
  propertyId: string
): Promise<string | null> {
  const { user, org } = await getCurrentOrgContext();

  if (isStaff(user.role)) {
    const prop = await prisma.property.findFirst({
      where: { id: propertyId, orgId: org.id },
      select: { id: true },
    });
    return prop ? org.id : null;
  }

  if (user.role === "HOMEOWNER") {
    const link = await prisma.homeowner.findFirst({
      where: { userId: user.id, propertyId },
      select: { id: true },
    });
    return link ? org.id : null;
  }

  return null;
}
