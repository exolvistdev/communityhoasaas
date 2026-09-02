import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";

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
 * Resolve the signed-in resident, all their linked units, and the active one.
 * `homeowner` / `property` are the active unit and are null when the account
 * isn't linked to any unit yet — pages show a "contact your HOA" message.
 * `homeowners` is the full list (used by the unit switcher).
 *
 * Portal access = the HOMEOWNER role, OR any user (e.g. a board member) who is
 * linked to at least one unit. Everyone else is bounced to their own home.
 */
export async function getHomeownerContext() {
  const { user, org, impersonating } = await getCurrentOrgContext();

  const homeowners = await prisma.homeowner.findMany({
    where: { userId: user.id },
    include: { property: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  if (user.role !== "HOMEOWNER" && homeowners.length === 0) redirect("/");

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
