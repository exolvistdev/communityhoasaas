import type { PrismaClient, TrusteePosition } from "@prisma/client";
import { SEED_ACCOUNTS, postInvoiceIssued } from "../lib/ledger";
import { deleteOrgCascade } from "../lib/org-teardown";
import { reapplyPerSqm } from "../lib/rate-reapply";
import { currentPeriod } from "../lib/format";

/**
 * A second demo org — a condominium — exercising the RA 4726 features:
 * buildings, per-sqm dues, floor-area-weighted voting, and a "Board of
 * Directors". Kept separate from the 1,700-line subdivision seed; `main()` in
 * seed.ts calls `resetCondoOrg` then `seedCondo` after the subdivision org.
 */

export const CONDO_SUBDOMAIN = "sample-condo";

export const CONDO_STAFF = [
  { email: "admin@sample-condo.ph", fullName: "Elena Marasigan", role: "ADMIN" as const },
  { email: "treasurer@sample-condo.ph", fullName: "Paolo Villanueva", role: "TREASURER" as const },
];
export const CONDO_HOMEOWNERS = [
  { email: "owner-a@sample-condo.ph", fullName: "Grace Lim", role: "HOMEOWNER" as const },
  { email: "owner-b@sample-condo.ph", fullName: "Miguel Torres", role: "HOMEOWNER" as const },
];
/** Emails seed.ts must provision Supabase auth users for. */
export const CONDO_AUTH_EMAILS = [
  ...CONDO_STAFF.map((s) => s.email),
  ...CONDO_HOMEOWNERS.map((h) => h.email),
];

const RATE_PER_SQM = 85;

// unitNumber, tower, floor, sqm, optional owner email, type
const UNITS: {
  unitNumber: string;
  tower: "A" | "B";
  floor: string;
  sqm: number;
  owner?: string;
  type: "CONDO_UNIT" | "PARKING_SLOT";
}[] = [
  { unitNumber: "TA-1203", tower: "A", floor: "12", sqm: 32.5, owner: "owner-a@sample-condo.ph", type: "CONDO_UNIT" },
  { unitNumber: "TA-1508", tower: "A", floor: "15", sqm: 58.0, type: "CONDO_UNIT" },
  { unitNumber: "TA-2102", tower: "A", floor: "21", sqm: 95.0, owner: "owner-b@sample-condo.ph", type: "CONDO_UNIT" },
  { unitNumber: "TB-0905", tower: "B", floor: "9", sqm: 41.0, type: "CONDO_UNIT" },
  { unitNumber: "TB-1804", tower: "B", floor: "18", sqm: 72.5, type: "CONDO_UNIT" },
  { unitNumber: "TB-PH01", tower: "B", floor: "PH", sqm: 140.0, type: "CONDO_UNIT" },
  { unitNumber: "P2-114", tower: "A", floor: "P2", sqm: 12.5, type: "PARKING_SLOT" },
  { unitNumber: "P2-115", tower: "B", floor: "P2", sqm: 12.5, type: "PARKING_SLOT" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

export async function resetCondoOrg(prisma: PrismaClient) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: CONDO_SUBDOMAIN },
  });
  if (org) await deleteOrgCascade(prisma, org.id);
}

export async function seedCondo(
  prisma: PrismaClient,
  auth: Record<string, string | null>
) {
  const org = await prisma.organization.create({
    data: {
      name: "Sample Tower Condominium",
      subdomain: CONDO_SUBDOMAIN,
      communityType: "CONDOMINIUM",
      duesRateMode: "PER_SQM",
      duesRatePerSqm: RATE_PER_SQM,
      voteWeightMode: "BY_FLOOR_AREA",
      waterSource: "EXTERNAL_BULK",
      electionArrearsMonths: 3,
      privacyContactEmail: "privacy@sample-condo.ph",
      gcashNumber: "0917 555 0200",
      gcashName: "Sample Tower Condominium Corp.",
      paymentInstructions:
        "Bank: BPI 9012-3456-78 (Sample Tower Condominium Corp.). " +
        "Association office, Ground Floor Tower A, Mon–Sat 9am–6pm.",
    },
  });

  await prisma.account.createMany({
    data: SEED_ACCOUNTS.map((a) => ({ ...a, orgId: org.id })),
  });

  for (const s of CONDO_STAFF) {
    await prisma.user.create({
      data: {
        orgId: org.id,
        authId: auth[s.email] ?? null,
        email: s.email,
        fullName: s.fullName,
        role: s.role,
        acceptedAt: new Date(),
      },
    });
  }
  const ownerUsers = new Map<string, string>();
  for (const h of CONDO_HOMEOWNERS) {
    const u = await prisma.user.create({
      data: {
        orgId: org.id,
        authId: auth[h.email] ?? null,
        email: h.email,
        fullName: h.fullName,
        role: h.role,
        acceptedAt: new Date(),
      },
    });
    ownerUsers.set(h.email, u.id);
  }
  const admin = await prisma.user.findFirstOrThrow({
    where: { orgId: org.id, role: "ADMIN" },
  });
  const nameByEmail = new Map(
    CONDO_HOMEOWNERS.map((h) => [h.email, h.fullName])
  );

  const towers: Record<"A" | "B", string> = {
    A: (await prisma.building.create({ data: { orgId: org.id, name: "Tower A" } })).id,
    B: (await prisma.building.create({ data: { orgId: org.id, name: "Tower B" } })).id,
  };

  const propByUnit = new Map<string, string>();
  for (const u of UNITS) {
    const p = await prisma.property.create({
      data: {
        orgId: org.id,
        unitNumber: u.unitNumber,
        type: u.type,
        monthlyRate: 0, // baked by reapplyPerSqm below
        buildingId: towers[u.tower],
        floor: u.floor,
        floorArea: u.sqm,
        homeowners: {
          create: [
            {
              fullName: u.owner
                ? nameByEmail.get(u.owner) ?? `Owner ${u.unitNumber}`
                : `Owner ${u.unitNumber}`,
              role: "OWNER",
              email: u.owner ?? null,
              isPrimary: true,
              userId: u.owner ? ownerUsers.get(u.owner) ?? null : null,
            },
          ],
        },
      },
    });
    propByUnit.set(u.unitNumber, p.id);
  }

  // Dues = ₱85/sqm × floor area, baked onto each unit.
  await reapplyPerSqm(prisma, org.id, RATE_PER_SQM);

  // One month of association-dues invoices.
  const period = currentPeriod();
  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, m - 1, 15);
  for (const propId of propByUnit.values()) {
    const fresh = await prisma.property.findUniqueOrThrow({ where: { id: propId } });
    const inv = await prisma.invoice.create({
      data: {
        propertyId: propId,
        amount: fresh.monthlyRate,
        period,
        dueDate,
        status: "SENT",
        memo: `Association dues — ${period}`,
      },
    });
    await postInvoiceIssued(inv.id);
  }

  // A weighted resolution whose outcome flips on floor area: the penthouse
  // (140) + a large unit (95) vote NO = 235; three smaller units vote YES =
  // 32.5 + 41 + 58 = 131.5. Three-to-two on units, but it FAILS on interest.
  const vote = await prisma.boardVote.create({
    data: {
      orgId: org.id,
      title: "Special assessment — Tower A lobby renovation",
      description:
        "A one-time ₱15,000-per-unit assessment to refit the Tower A lobby and lift interiors.",
      status: "OPEN",
      opensAt: daysAgo(3),
      closesAt: daysFromNow(4),
      quorumPct: 50,
      threshold: "MAJORITY",
      createdById: admin.id,
    },
  });
  const ballotPlan: [string, "YES" | "NO"][] = [
    ["TB-PH01", "NO"],
    ["TA-2102", "NO"],
    ["TA-1203", "YES"],
    ["TB-0905", "YES"],
    ["TA-1508", "YES"],
  ];
  for (const [unit, choice] of ballotPlan) {
    await prisma.ballot.create({
      data: { voteId: vote.id, propertyId: propByUnit.get(unit)!, choice },
    });
  }

  // A finalized Board of Directors election → three seated directors.
  const election = await prisma.election.create({
    data: {
      orgId: org.id,
      title: "2026 Board of Directors Election",
      description: "Three seats on the condominium corporation's board.",
      seats: 3,
      status: "CLOSED",
      opensAt: daysAgo(30),
      closesAt: daysAgo(10),
      quorumPct: 40,
      termMonths: 12,
      finalizedAt: daysAgo(9),
    },
  });
  const candidateNames = [
    "Grace Lim",
    "Miguel Torres",
    "Elena Marasigan",
    "Ramon Aquino",
  ];
  const candidates = [];
  for (const name of candidateNames) {
    candidates.push(
      await prisma.electionCandidate.create({
        data: { electionId: election.id, name },
      })
    );
  }
  // every unit approves the first three candidates
  for (const propId of propByUnit.values()) {
    const b = await prisma.electionBallot.create({
      data: { electionId: election.id, propertyId: propId },
    });
    await prisma.electionVote.createMany({
      data: candidates.slice(0, 3).map((c) => ({
        ballotId: b.id,
        candidateId: c.id,
      })),
    });
  }
  const termStart = daysAgo(10);
  const termEnd = new Date(termStart);
  termEnd.setMonth(termEnd.getMonth() + 12);
  const positions: TrusteePosition[] = [
    "CHAIRPERSON", // renders as "President" for a condominium
    "VICE_CHAIRPERSON",
    "TREASURER",
  ];
  for (let i = 0; i < 3; i++) {
    await prisma.trustee.create({
      data: {
        orgId: org.id,
        electionId: election.id,
        name: candidates[i].name,
        position: positions[i],
        termStart,
        termEnd,
      },
    });
  }

  return org;
}
