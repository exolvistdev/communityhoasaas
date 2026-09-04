import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  boardRoster,
  assignTrusteePosition,
  seatTrustee,
} from "@/lib/board";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-board";
const DAY = 86_400_000;

describe.skipIf(!hasTestDb)("trustee roster", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    orgId = (await createTestOrg({ name: "Board Test HOA", subdomain: SUB })).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  const mk = (name: string, over: Record<string, unknown> = {}) =>
    prisma.trustee.create({
      data: {
        orgId,
        name,
        position: "MEMBER",
        termStart: new Date(Date.now() - 30 * DAY),
        termEnd: new Date(Date.now() + 300 * DAY),
        ...over,
      },
    });

  it("boardRoster splits active vs ended / expired", async () => {
    const active = await mk("Active Annie");
    await mk("Ended Ed", { endedAt: new Date() });
    await mk("Expired Xavier", {
      termStart: new Date(Date.now() - 400 * DAY),
      termEnd: new Date(Date.now() - 30 * DAY),
    });

    const { current, past } = await boardRoster(orgId);
    expect(current.map((t) => t.id)).toEqual([active.id]);
    expect(past).toHaveLength(2);
  });

  it("assignTrusteePosition swaps a single-holder officer role", async () => {
    await prisma.trustee.deleteMany({ where: { orgId } });
    const a = await mk("A");
    const b = await mk("B");

    await assignTrusteePosition(orgId, a.id, "CHAIRPERSON");
    expect((await prisma.trustee.findUniqueOrThrow({ where: { id: a.id } })).position).toBe(
      "CHAIRPERSON"
    );

    await assignTrusteePosition(orgId, b.id, "CHAIRPERSON");
    expect((await prisma.trustee.findUniqueOrThrow({ where: { id: b.id } })).position).toBe(
      "CHAIRPERSON"
    );
    // A was bumped back to MEMBER
    expect((await prisma.trustee.findUniqueOrThrow({ where: { id: a.id } })).position).toBe(
      "MEMBER"
    );
  });

  it("seatTrustee demotes an existing officer when appointing another", async () => {
    await prisma.trustee.deleteMany({ where: { orgId } });
    const held = await mk("Held", { position: "TREASURER" });

    await seatTrustee({
      orgId,
      homeownerId: null,
      userId: null,
      name: "New Treasurer",
      position: "TREASURER",
      termStart: new Date(),
      termEnd: new Date(Date.now() + 300 * DAY),
    });

    expect(
      (await prisma.trustee.findUniqueOrThrow({ where: { id: held.id } })).position
    ).toBe("MEMBER");
    expect(
      await prisma.trustee.count({ where: { orgId, position: "TREASURER", endedAt: null } })
    ).toBe(1);
  });
});
