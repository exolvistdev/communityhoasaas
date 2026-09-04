"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { controllableUnits } from "@/lib/votes";
import { unitInGoodStanding } from "@/lib/good-standing";
import { recordElectionBallot } from "@/lib/elections";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  propertyId: z.string().min(1),
  candidateIds: z.array(z.string().min(1)).max(50),
});

export async function castElectionBallot(
  electionId: string,
  input: unknown
): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const election = await prisma.election.findFirst({
    where: { id: electionId, orgId: org.id },
    select: { id: true },
  });
  if (!election) return { ok: false, error: "Election not found" };

  const { propertyId, candidateIds } = parsed.data;
  const control = await controllableUnits(user.id, org.id);
  const isOwn = control.own.some((p) => p.id === propertyId);
  const proxy = control.proxy.find((p) => p.propertyId === propertyId);
  if (!isOwn && !proxy)
    return { ok: false, error: "You can't cast a ballot for that unit." };

  if (!(await unitInGoodStanding(org.id, propertyId)))
    return {
      ok: false,
      error: "This unit is behind on dues and can't vote until the balance is settled.",
    };

  const res = await recordElectionBallot({
    electionId,
    propertyId,
    candidateIds,
    castById: user.id,
    viaProxyId: isOwn ? null : proxy!.proxyId,
  });
  if (!res.ok) return res;

  revalidatePath("/portal/elections");
  revalidatePath("/portal", "layout");
  revalidatePath(`/elections/${electionId}`);
  return { ok: true };
}
