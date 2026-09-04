import { prisma } from "@/lib/prisma";
import { Prisma, type TrusteePosition } from "@prisma/client";
import { OFFICER_POSITIONS } from "@/lib/election";

const RANK: Record<TrusteePosition, number> = {
  CHAIRPERSON: 0,
  VICE_CHAIRPERSON: 1,
  SECRETARY: 2,
  TREASURER: 3,
  MEMBER: 4,
};

export type TrusteeRow = {
  id: string;
  name: string;
  position: TrusteePosition;
  unitNumber: string | null;
  termStart: Date;
  termEnd: Date;
  endedAt: Date | null;
  fromElection: boolean;
};

const isActive = (r: { endedAt: Date | null; termStart: Date; termEnd: Date }, now: Date) =>
  r.endedAt == null && r.termStart <= now && now <= r.termEnd;

/** Current + past trustees for an org. Current = not ended and inside the term. */
export async function boardRoster(orgId: string, now: Date = new Date()) {
  const trustees = await prisma.trustee.findMany({
    where: { orgId },
    include: {
      homeowner: { select: { property: { select: { unitNumber: true } } } },
    },
    orderBy: { termStart: "desc" },
  });

  const rows: TrusteeRow[] = trustees.map((t) => ({
    id: t.id,
    name: t.name,
    position: t.position,
    unitNumber: t.homeowner?.property.unitNumber ?? null,
    termStart: t.termStart,
    termEnd: t.termEnd,
    endedAt: t.endedAt,
    fromElection: t.electionId != null,
  }));

  return {
    current: rows
      .filter((r) => isActive(r, now))
      .sort(
        (a, b) => RANK[a.position] - RANK[b.position] || a.name.localeCompare(b.name)
      ),
    past: rows
      .filter((r) => !isActive(r, now))
      .sort((a, b) => b.termEnd.getTime() - a.termEnd.getTime()),
  };
}

/** An officer role is single-holder — bump any current holder down to MEMBER. */
async function clearOfficer(
  tx: Prisma.TransactionClient,
  orgId: string,
  position: TrusteePosition,
  exceptId?: string
) {
  if (!OFFICER_POSITIONS.includes(position)) return;
  await tx.trustee.updateMany({
    where: {
      orgId,
      position,
      endedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { position: "MEMBER" },
  });
}

/** Set a trustee's position, enforcing single-holder officer roles (swap). */
export async function assignTrusteePosition(
  orgId: string,
  trusteeId: string,
  position: TrusteePosition
) {
  const trustee = await prisma.trustee.findFirst({
    where: { id: trusteeId, orgId },
  });
  if (!trustee) return { ok: false as const, error: "Trustee not found", name: "" };
  if (trustee.position === position)
    return { ok: true as const, name: trustee.name };

  await prisma.$transaction(async (tx) => {
    await clearOfficer(tx, orgId, position, trusteeId);
    await tx.trustee.update({ where: { id: trusteeId }, data: { position } });
  });
  return { ok: true as const, name: trustee.name };
}

/** Create a trustee row (from an appointment), swapping any officer holder. */
export async function seatTrustee(input: {
  orgId: string;
  homeownerId: string | null;
  userId: string | null;
  name: string;
  position: TrusteePosition;
  termStart: Date;
  termEnd: Date;
}) {
  await prisma.$transaction(async (tx) => {
    await clearOfficer(tx, input.orgId, input.position);
    await tx.trustee.create({
      data: {
        orgId: input.orgId,
        homeownerId: input.homeownerId,
        userId: input.userId,
        name: input.name,
        position: input.position,
        termStart: input.termStart,
        termEnd: input.termEnd,
      },
    });
  });
}
