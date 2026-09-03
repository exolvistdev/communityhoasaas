import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { deliver, recipientSelect } from "@/lib/notifications";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
} from "../fixtures";

const SUB = "test-maintenance";

describe.skipIf(!hasTestDb)("maintenance requests", () => {
  let orgId: string;
  let propertyId: string;
  let residentId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Maintenance Test HOA", subdomain: SUB });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId)).id;
    residentId = (
      await prisma.user.create({
        data: {
          orgId,
          email: "res@test-maintenance.ph",
          fullName: "Rita Resident",
          role: "HOMEOWNER",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("a request + comments round-trips, staff-only comments are separable", async () => {
    const request = await prisma.maintenanceRequest.create({
      data: {
        orgId,
        propertyId,
        requesterId: residentId,
        category: "PLUMBING",
        title: "Leaky tap",
        description: "Drips overnight",
      },
    });

    await prisma.maintenanceComment.createMany({
      data: [
        { requestId: request.id, authorId: residentId, body: "Getting worse", staffOnly: false },
        { requestId: request.id, body: "Quote pending", staffOnly: true },
      ],
    });

    const publicComments = await prisma.maintenanceComment.count({
      where: { requestId: request.id, staffOnly: false },
    });
    const allComments = await prisma.maintenanceComment.count({
      where: { requestId: request.id },
    });
    expect(publicComments).toBe(1);
    expect(allComments).toBe(2);
  });

  it("a status change delivers a MAINTENANCE_UPDATE notification to the requester", async () => {
    const request = await prisma.maintenanceRequest.findFirstOrThrow({
      where: { orgId },
    });
    await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: { status: "IN_PROGRESS" },
    });

    const requester = await prisma.user.findUniqueOrThrow({
      where: { id: residentId },
      select: recipientSelect,
    });
    await deliver({
      users: [requester],
      type: "MAINTENANCE_UPDATE",
      title: "Maintenance update",
      body: "Your request is now in progress.",
      href: `/portal/maintenance/${request.id}`,
    });

    const notif = await prisma.notification.findFirst({
      where: { userId: residentId, type: "MAINTENANCE_UPDATE" },
    });
    expect(notif).not.toBeNull();
    expect(notif?.href).toContain(request.id);
  });
});
