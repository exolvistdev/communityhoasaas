import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertLedgerBalances, arLedgerBalance } from "@/lib/ledger";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
} from "../fixtures";

// executeCloseout news up a service-role Supabase client at the top of its
// login-revocation step; stub it so the test doesn't need real credentials.
// (Our close-out property has no linked logins, so no method is actually called.)
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

const SUB = "test-closeout";

describe.skipIf(!hasTestDb)("executeCloseout — write-off path", () => {
  let orgId: string;
  let handlerId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Closeout Test HOA", subdomain: SUB });
    orgId = org.id;
    const handler = await prisma.user.create({
      data: { orgId, email: "admin@test-closeout.ph", fullName: "Admin", role: "ADMIN" },
    });
    handlerId = handler.id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  it("writes off the outstanding balance, archives the unit and records the transfer", async () => {
    const { executeCloseout } = await import("@/lib/closeout");
    const property = await createTestProperty(orgId, {
      monthlyRate: 1500,
      homeownerName: "Former Owner",
    });
    const arBaseline = await arLedgerBalance(orgId);
    await issueInvoice(property.id, {
      amount: 1500,
      period: "2026-06",
      dueDate: new Date(Date.now() - 60 * 86_400_000),
    });

    const res = await executeCloseout(
      {
        propertyId: property.id,
        settlement: "WRITTEN_OFF",
        vacated: true,
        effectiveDate: "2026-07-01",
        note: "Unit vacated; uncollectible.",
      },
      { orgId, handlerId }
    );

    expect(res.ok).toBe(true);

    const stmt = await buildStatement(property.id, parseStatementRange({}));
    expect(Math.max(stmt?.closingBalance ?? 0, 0)).toBeCloseTo(0, 2);

    // issue (+1500 AR) then write-off (−1500 AR) nets back to the baseline
    expect(await arLedgerBalance(orgId)).toBeCloseTo(arBaseline, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);

    const archived = await prisma.property.findUniqueOrThrow({ where: { id: property.id } });
    expect(archived.archivedAt).not.toBeNull();

    const transfer = await prisma.ownershipTransfer.findFirstOrThrow({
      where: { propertyId: property.id },
    });
    expect(transfer.settlement).toBe("WRITTEN_OFF");
    expect(Number(transfer.finalBalance)).toBeCloseTo(1500, 2);
  });
});
