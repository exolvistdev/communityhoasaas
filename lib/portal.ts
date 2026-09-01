import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/rbac";

/**
 * Resolve the signed-in homeowner, their linked property, and the org.
 * `homeowner` / `property` are null when a HOMEOWNER account exists but hasn't
 * been linked to a unit yet — pages should show a "contact your HOA" message.
 */
export async function getHomeownerContext() {
  const { user, org } = await requirePortalRole("HOMEOWNER");

  const homeowner = await prisma.homeowner.findFirst({
    where: { userId: user.id },
    include: { property: true },
  });

  return {
    user,
    org,
    homeowner,
    property: homeowner?.property ?? null,
  };
}
