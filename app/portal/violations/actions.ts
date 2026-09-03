"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { deliver, staffRecipients } from "@/lib/notifications";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  note: z.string().trim().min(5, "Tell us why you're appealing").max(1000),
});

export async function appealViolation(
  violationId: string,
  input: unknown
): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org, homeowners } = await getHomeownerContext();
  const propertyIds = homeowners.map((h) => h.propertyId);

  const violation = await prisma.violation.findFirst({
    where: { id: violationId, orgId: org.id, propertyId: { in: propertyIds } },
    include: { property: { select: { unitNumber: true } } },
  });
  if (!violation) return { ok: false, error: "Violation not found" };
  if (violation.status !== "OPEN")
    return {
      ok: false,
      error: "Only an open violation can be appealed. Contact the HOA office.",
    };

  await prisma.violation.update({
    where: { id: violationId },
    data: { status: "APPEALED", resolutionNote: parsed.data.note },
  });

  revalidatePath("/portal/violations");
  revalidatePath("/violations");
  revalidatePath(`/violations/${violationId}`);

  const staff = await staffRecipients(org.id, [
    "ADMIN",
    "BOARD_MEMBER",
    "TREASURER",
  ]).catch(() => []);
  if (staff.length)
    await deliver({
      users: staff,
      type: "VIOLATION_NOTICE",
      title: `Violation appealed — ${violation.property.unitNumber}`,
      body: `${user.fullName} is contesting the ${violation.category.toLowerCase()} violation: "${parsed.data.note.slice(
        0,
        160
      )}"`,
      href: `/violations/${violationId}`,
    }).catch(() => {});

  return { ok: true };
}
