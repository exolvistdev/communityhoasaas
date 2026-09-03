import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { rsvpTally } from "@/lib/meeting";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-meetings";

describe.skipIf(!hasTestDb)("board meetings + RSVPs", () => {
  let orgId: string;
  let u1: string;
  let u2: string;
  let meetingId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Meetings Test HOA", subdomain: SUB });
    orgId = org.id;
    [u1, u2] = await Promise.all([
      prisma.user
        .create({ data: { orgId, email: "a@test-meetings.ph", fullName: "Al", role: "HOMEOWNER" } })
        .then((u) => u.id),
      prisma.user
        .create({ data: { orgId, email: "b@test-meetings.ph", fullName: "Bea", role: "HOMEOWNER" } })
        .then((u) => u.id),
    ]);
    meetingId = (
      await prisma.boardMeeting.create({
        data: {
          orgId,
          title: "AGM",
          scheduledAt: new Date("2026-12-01T11:00:00Z"),
          agenda: "1. Everything",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("RSVPs upsert on the (meeting, user) unique key", async () => {
    const upsert = (userId: string, response: "YES" | "NO" | "MAYBE") =>
      prisma.meetingRsvp.upsert({
        where: { meetingId_userId: { meetingId, userId } },
        create: { meetingId, userId, response },
        update: { response },
      });

    await upsert(u1, "YES");
    await upsert(u2, "MAYBE");
    await upsert(u1, "NO"); // Al changes his mind

    const rsvps = await prisma.meetingRsvp.findMany({ where: { meetingId } });
    expect(rsvps).toHaveLength(2);
    expect(rsvpTally(rsvps)).toEqual({ yes: 0, no: 1, maybe: 1, total: 2 });
  });

  it("deleting the meeting cascades its RSVPs", async () => {
    await prisma.boardMeeting.delete({ where: { id: meetingId } });
    expect(await prisma.meetingRsvp.count({ where: { meetingId } })).toBe(0);
  });
});
