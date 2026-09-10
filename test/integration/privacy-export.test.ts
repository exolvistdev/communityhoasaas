import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildDataExport } from "@/lib/privacy";
import { hasTestDb, resetTestOrg, createTestOrg, createTestProperty } from "../fixtures";

const SUB = "test-privacy-export";

describe.skipIf(!hasTestDb)("buildDataExport — expanded coverage", () => {
  let orgId: string;
  let userId: string;
  let otherUserId: string;
  let propertyId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    orgId = (await createTestOrg({ name: "Export Test HOA", subdomain: SUB })).id;

    const p = await createTestProperty(orgId, { unitNumber: "A-1", monthlyRate: 1500 });
    propertyId = p.id;

    const user = await prisma.user.create({
      data: { orgId, email: "resident@x.ph", fullName: "Resident One", role: "HOMEOWNER" },
    });
    userId = user.id;
    await prisma.homeowner.create({
      data: { propertyId, userId, fullName: "Resident One", role: "OWNER", isPrimary: true },
    });

    const other = await prisma.user.create({
      data: { orgId, email: "other@x.ph", fullName: "Other Resident", role: "HOMEOWNER" },
    });
    otherUserId = other.id;
    const p2 = await createTestProperty(orgId, { unitNumber: "A-2", monthlyRate: 1500 });
    await prisma.homeowner.create({
      data: { propertyId: p2.id, userId: otherUserId, fullName: "Other Resident", role: "OWNER", isPrimary: true },
    });

    // violation + fine on the resident's unit
    const violation = await prisma.violation.create({
      data: {
        orgId,
        propertyId,
        category: "PARKING",
        description: "Parked in a visitor slot",
        occurredAt: new Date("2026-08-01"),
      },
    });
    await prisma.fineNotice.create({
      data: {
        orgId,
        violationId: violation.id,
        noticeNumber: 1,
        amount: 500,
        dueDate: new Date("2026-09-01"),
      },
    });

    // maintenance request with one visible + one staff-only comment
    const req = await prisma.maintenanceRequest.create({
      data: {
        orgId,
        propertyId,
        requesterId: userId,
        category: "PLUMBING",
        title: "Leaky tap",
        description: "Kitchen tap drips",
      },
    });
    await prisma.maintenanceComment.createMany({
      data: [
        { requestId: req.id, authorId: userId, body: "Still dripping", staffOnly: false },
        { requestId: req.id, authorId: otherUserId, body: "internal: assign to plumber", staffOnly: true },
      ],
    });

    // a resolution ballot cast by the resident
    const vote = await prisma.boardVote.create({
      data: {
        orgId,
        title: "Repaint the lobby",
        description: "x",
        status: "OPEN",
        opensAt: new Date("2026-08-01"),
        closesAt: new Date("2026-09-01"),
        quorumPct: 50,
      },
    });
    await prisma.ballot.create({
      data: { voteId: vote.id, propertyId, choice: "YES", castById: userId },
    });

    // an election ballot with a pick
    const election = await prisma.election.create({
      data: {
        orgId,
        title: "2026 Board",
        description: "x",
        seats: 1,
        status: "OPEN",
        opensAt: new Date("2026-08-01"),
        closesAt: new Date("2026-09-01"),
        quorumPct: 50,
      },
    });
    const cand = await prisma.electionCandidate.create({
      data: { electionId: election.id, name: "Alice" },
    });
    const eBallot = await prisma.electionBallot.create({
      data: { electionId: election.id, propertyId, castById: userId },
    });
    await prisma.electionVote.create({
      data: { ballotId: eBallot.id, candidateId: cand.id },
    });

    // water meter + reading
    const meter = await prisma.waterMeter.create({
      data: { orgId, propertyId, kind: "UNIT" },
    });
    await prisma.meterReading.create({
      data: {
        meterId: meter.id,
        orgId,
        period: "2026-08",
        readingDate: new Date("2026-08-31"),
        priorReading: 100,
        currentReading: 112,
        consumption: 12,
        amount: 240,
      },
    });

    // a document the resident uploaded
    await prisma.document.create({
      data: {
        orgId,
        title: "My waiver",
        category: "OTHER",
        storagePath: `${orgId}/x.pdf`,
        fileName: "waiver.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
        uploadedById: userId,
      },
    });

    // an ownership transfer on the resident's unit
    await prisma.ownershipTransfer.create({
      data: {
        orgId,
        propertyId,
        previousOwnerName: "Old Owner",
        newOwnerName: "Resident One",
        finalBalance: 0,
        settlement: "SETTLED",
        effectiveDate: new Date("2026-01-01"),
      },
    });
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("includes every expanded category, scoped to the user", async () => {
    const x = (await buildDataExport(userId, orgId)) as any;
    expect(x).toBeTruthy();

    expect(x.violations).toHaveLength(1);
    expect(x.violations[0].fines[0].amount).toBe(500);

    expect(x.maintenanceRequests).toHaveLength(1);
    const comments = x.maintenanceRequests[0].comments;
    expect(comments).toHaveLength(1); // the staff-only one is excluded
    expect(comments[0]).toMatchObject({ from: "you", body: "Still dripping" });

    expect(x.governance.resolutionVotes[0]).toMatchObject({
      vote: "Repaint the lobby",
      choice: "YES",
    });
    expect(x.governance.electionBallots[0].votedFor).toEqual(["Alice"]);

    expect(x.waterReadings[0]).toMatchObject({ period: "2026-08", consumption: 12 });
    expect(x.documentsYouUploaded[0].fileName).toBe("waiver.pdf");
    expect(x.ownershipTransfers[0].previousOwner).toBe("Old Owner");
  });

  it("does not leak the other resident's data", async () => {
    const x = (await buildDataExport(otherUserId, orgId)) as any;
    // the other resident owns A-2 and did none of the above
    expect(x.violations ?? []).toHaveLength(0);
    expect(x.maintenanceRequests ?? []).toHaveLength(0);
    expect(x.governance).toBeUndefined();
    expect(x.waterReadings ?? []).toHaveLength(0);
    expect(x.documentsYouUploaded ?? []).toHaveLength(0);
    expect(x.ownershipTransfers ?? []).toHaveLength(0);
  });
});
