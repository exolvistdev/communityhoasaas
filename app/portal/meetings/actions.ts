"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  response: z.enum(["YES", "NO", "MAYBE"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function setRsvp(
  meetingId: string,
  input: unknown
): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const meeting = await prisma.boardMeeting.findFirst({
    where: { id: meetingId, orgId: org.id },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };
  if (meeting.status !== "SCHEDULED")
    return { ok: false, error: "RSVPs are closed for this meeting." };

  const d = parsed.data;
  await prisma.meetingRsvp.upsert({
    where: { meetingId_userId: { meetingId, userId: user.id } },
    create: {
      meetingId,
      userId: user.id,
      response: d.response,
      note: d.note || null,
    },
    update: { response: d.response, note: d.note || null },
  });

  revalidatePath("/portal/meetings");
  revalidatePath("/portal", "layout");
  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}
