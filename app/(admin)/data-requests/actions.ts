"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { PERMISSION_DENIED } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  status: z.enum(["COMPLETED", "REJECTED"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function resolveDataRequest(
  id: string,
  input: unknown
): Promise<Result> {
  const { org, user } = await getCurrentOrgContext();
  if (user.role !== "ADMIN") return PERMISSION_DENIED;

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const req = await prisma.dataRequest.findFirst({
    where: { id, orgId: org.id, status: "PENDING" },
    include: { user: { select: { fullName: true } } },
  });
  if (!req) return { ok: false, error: "Request not found" };

  await prisma.dataRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      handledById: user.id,
      handledAt: new Date(),
      decisionNote: parsed.data.note || null,
    },
  });

  revalidatePath("/data-requests");
  revalidatePath("/dashboard");
  await logAudit({
    action:
      parsed.data.status === "COMPLETED"
        ? "privacy.deletion_completed"
        : "privacy.deletion_rejected",
    target: req.user.fullName,
    detail: parsed.data.note || undefined,
  });
  return { ok: true };
}
