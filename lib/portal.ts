import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/rbac";

/** Cookie holding the propertyId of the unit the resident is currently viewing. */
export const ACTIVE_UNIT_COOKIE = "hoa_unit";

const homeownerWithProperty = {
  include: { property: true },
} satisfies Prisma.HomeownerDefaultArgs;

export type HomeownerLink = Prisma.HomeownerGetPayload<typeof homeownerWithProperty>;

/**
 * Choose which of a resident's linked units is "active": the one named by the
 * cookie if still valid, else the primary, else the first. Tolerates zero or
 * several `isPrimary` rows (no DB uniqueness on that flag).
 */
export function pickActiveHomeowner(
  homeowners: HomeownerLink[],
  preferPropertyId?: string
): HomeownerLink | null {
  if (homeowners.length === 0) return null;
  if (preferPropertyId) {
    const match = homeowners.find((h) => h.propertyId === preferPropertyId);
    if (match) return match;
  }
  return homeowners.find((h) => h.isPrimary) ?? homeowners[0];
}

/**
 * Resolve the signed-in homeowner, all their linked units, and the active one.
 * `homeowner` / `property` are the active unit and are null when the account
 * isn't linked to any unit yet — pages show a "contact your HOA" message.
 * `homeowners` is the full list (used by the unit switcher).
 */
export async function getHomeownerContext() {
  const { user, org, impersonating } = await requirePortalRole("HOMEOWNER");

  const homeowners = await prisma.homeowner.findMany({
    where: { userId: user.id },
    include: { property: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const preferred = cookies().get(ACTIVE_UNIT_COOKIE)?.value;
  const active = pickActiveHomeowner(homeowners, preferred);

  return {
    user,
    org,
    impersonating,
    homeowners,
    homeowner: active,
    property: active?.property ?? null,
  };
}
