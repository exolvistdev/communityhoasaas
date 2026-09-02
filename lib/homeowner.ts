// Pure helper — safe to import anywhere.

type UnitLink = {
  isPrimary: boolean;
  property: { unitNumber: string } | null;
};

/**
 * The unit label to show for a user who may be linked to several units:
 * their primary unit, else the first. Null when they aren't linked to any.
 */
export function displayUnit(homeowners: UnitLink[] | null | undefined): string | null {
  if (!homeowners?.length) return null;
  const h = homeowners.find((x) => x.isPrimary) ?? homeowners[0];
  return h.property?.unitNumber ?? null;
}

/** Prisma `select` fragment for a user's units, enough for `displayUnit`. */
export const unitLinkSelect = {
  isPrimary: true,
  property: { select: { unitNumber: true } },
} as const;
