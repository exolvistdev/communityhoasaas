import { PrismaClient } from "@prisma/client";
import {
  SEED_ACCOUNTS,
  postInvoiceIssued,
  postPaymentReceived,
} from "../lib/ledger";
import { currentPeriod } from "../lib/format";
import { generateGatePassCode } from "../lib/gatepass";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo-password-123";

const DEMO_STAFF = [
  { email: "admin@sample-hoa.ph", fullName: "Maria Santos", role: "ADMIN" as const },
  { email: "treasurer@sample-hoa.ph", fullName: "Ramon Cruz", role: "TREASURER" as const },
  { email: "board@sample-hoa.ph", fullName: "Elena Villanueva", role: "BOARD_MEMBER" as const },
  { email: "guard@sample-hoa.ph", fullName: "Boy Guard", role: "GUARD" as const },
];
// One homeowner login, linked below to Blk 1 Lot 1's owner.
const DEMO_HOMEOWNER = {
  email: "juan@example.com",
  fullName: "Juan Dela Cruz",
  role: "HOMEOWNER" as const,
};

type SeededAuth = Record<string, string | null>; // email -> authId

/** Create matching Supabase auth users. No-ops (returns nulls) without a
 *  service-role key. */
async function createDemoAuthUsers(): Promise<SeededAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const all = [...DEMO_STAFF, DEMO_HOMEOWNER];
  const out: SeededAuth = {};
  if (!url || !key) {
    console.log("  (no service-role key — skipping auth users; DB-only demo)");
    for (const u of all) out[u.email] = null;
    return out;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of all) {
    const existing = list?.users.find((x) => x.email === u.email);
    if (existing) await admin.auth.admin.deleteUser(existing.id);
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });
    if (error) throw error;
    out[u.email] = data.user!.id;
  }
  return out;
}

const RATE_PLANS = [
  { name: "Standard Residential", monthlyRate: 1500 },
  { name: "Townhouse", monthlyRate: 2200 },
  { name: "Commercial", monthlyRate: 5000 },
] as const;

type Person = {
  fullName: string;
  role?: "OWNER" | "CO_OWNER" | "RENTER";
  email?: string;
  phone?: string;
  isPrimary?: boolean;
};

const PROPERTIES: {
  unitNumber: string;
  type: "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE";
  plan: string | null;
  rate: number;
  people: Person[];
}[] = [
  {
    unitNumber: "Blk 1 Lot 1",
    type: "RESIDENTIAL",
    plan: "Standard Residential",
    rate: 1500,
    people: [{ fullName: "Juan Dela Cruz", role: "OWNER", isPrimary: true }],
  },
  {
    unitNumber: "Blk 1 Lot 2",
    type: "RESIDENTIAL",
    plan: "Standard Residential",
    rate: 1500,
    people: [
      { fullName: "Ana Reyes", role: "OWNER", isPrimary: true },
      { fullName: "Luis Reyes", role: "CO_OWNER" },
    ],
  },
  {
    unitNumber: "Blk 1 Lot 3",
    type: "TOWNHOUSE",
    plan: "Townhouse",
    rate: 2200,
    people: [{ fullName: "Marco Lim", role: "OWNER", isPrimary: true }],
  },
  {
    unitNumber: "Blk 2 Lot 5",
    type: "RESIDENTIAL",
    plan: null, // custom rate — exercises the no-plan path
    rate: 1650,
    people: [
      { fullName: "Grace Tan", role: "OWNER" },
      { fullName: "Peter Uy", role: "RENTER", isPrimary: true },
    ],
  },
  {
    unitNumber: "Commercial Unit A",
    type: "COMMERCIAL",
    plan: "Commercial",
    rate: 5000,
    people: [{ fullName: "Sari-Sari Corp.", role: "OWNER", isPrimary: true }],
  },
];

/** Remove a previously-seeded demo org and all its rows, in FK order. */
async function resetDemoOrg() {
  const org = await prisma.organization.findUnique({
    where: { subdomain: "sample-hoa" },
  });
  if (!org) return;
  const orgId = org.id;
  await prisma.journalLine.deleteMany({ where: { entry: { orgId } } });
  await prisma.journalEntry.deleteMany({ where: { orgId } });
  await prisma.payment.deleteMany({
    where: { invoice: { property: { orgId } } },
  });
  await prisma.invoice.deleteMany({ where: { property: { orgId } } });
  await prisma.gatePass.deleteMany({ where: { property: { orgId } } });
  await prisma.announcement.deleteMany({ where: { orgId } });
  await prisma.homeowner.deleteMany({ where: { property: { orgId } } });
  await prisma.property.deleteMany({ where: { orgId } });
  await prisma.ratePlan.deleteMany({ where: { orgId } });
  await prisma.account.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

async function main() {
  await resetDemoOrg();
  const auth = await createDemoAuthUsers();

  const org = await prisma.organization.create({
    data: {
      name: "Sample Subdivision HOA",
      subdomain: "sample-hoa",
      gcashNumber: "0917 555 0100",
      gcashName: "Sample Subdivision HOA Inc.",
      mayaNumber: "0917 555 0100",
      mayaName: "Sample Subdivision HOA Inc.",
      paymentInstructions:
        "Bank: BDO 1234-5678-90 (Sample Subdivision HOA Inc.). " +
        "Cash: HOA office, Mon–Fri 9am–5pm.",
    },
  });

  await prisma.account.createMany({
    data: SEED_ACCOUNTS.map((a) => ({ ...a, orgId: org.id })),
  });

  for (const s of DEMO_STAFF) {
    await prisma.user.create({
      data: {
        orgId: org.id,
        authId: auth[s.email],
        email: s.email,
        fullName: s.fullName,
        role: s.role,
        acceptedAt: new Date(),
      },
    });
  }
  const homeownerUser = await prisma.user.create({
    data: {
      orgId: org.id,
      authId: auth[DEMO_HOMEOWNER.email],
      email: DEMO_HOMEOWNER.email,
      fullName: DEMO_HOMEOWNER.fullName,
      role: DEMO_HOMEOWNER.role,
      acceptedAt: new Date(),
    },
  });
  const admin = await prisma.user.findFirstOrThrow({
    where: { orgId: org.id, role: "ADMIN" },
  });

  const plans = new Map<string, string>();
  for (const rp of RATE_PLANS) {
    const created = await prisma.ratePlan.create({
      data: { orgId: org.id, name: rp.name, monthlyRate: rp.monthlyRate },
    });
    plans.set(rp.name, created.id);
  }

  const period = currentPeriod();
  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, m - 1, 15);

  const invoiceByUnit = new Map<string, string>();

  for (const [i, p] of PROPERTIES.entries()) {
    const property = await prisma.property.create({
      data: {
        orgId: org.id,
        unitNumber: p.unitNumber,
        type: p.type,
        monthlyRate: p.rate,
        ratePlanId: p.plan ? plans.get(p.plan) : null,
        homeowners: {
          create: p.people.map((person) => ({
            fullName: person.fullName,
            role: person.role ?? "OWNER",
            email: person.email ?? null,
            phone: person.phone ?? null,
            isPrimary: person.isPrimary ?? false,
          })),
        },
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: property.id,
        amount: p.rate,
        period,
        dueDate,
        status: "SENT",
        memo: `Monthly dues — ${period}`,
      },
    });
    await postInvoiceIssued(invoice.id);
    invoiceByUnit.set(p.unitNumber, invoice.id);

    // Pay the first two in full, one partially, leave the rest outstanding.
    if (i < 2) {
      const pay = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: p.rate,
          method: "GCASH",
          status: "CONFIRMED",
          confirmedById: admin.id,
          confirmedAt: new Date(),
        },
      });
      await postPaymentReceived(pay.id);
    } else if (i === 2) {
      const pay = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: 1000,
          method: "CASH",
          status: "CONFIRMED",
          confirmedById: admin.id,
          confirmedAt: new Date(),
        },
      });
      await postPaymentReceived(pay.id);
    }
  }

  // An archived (moved-out) unit — excluded from billing and the active list.
  await prisma.property.create({
    data: {
      orgId: org.id,
      unitNumber: "Blk 3 Lot 9",
      type: "RESIDENTIAL",
      monthlyRate: 1500,
      archivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      homeowners: {
        create: { fullName: "Former Owner", role: "OWNER", isPrimary: true },
      },
    },
  });

  // Link the demo homeowner login to Blk 1 Lot 1's owner.
  const juan = await prisma.homeowner.findFirstOrThrow({
    where: { property: { orgId: org.id, unitNumber: "Blk 1 Lot 1" }, fullName: "Juan Dela Cruz" },
  });
  await prisma.homeowner.update({
    where: { id: juan.id },
    data: { userId: homeownerUser.id },
  });

  // Pending payments submitted from the portal, awaiting reconciliation.
  await prisma.payment.create({
    data: {
      invoiceId: invoiceByUnit.get("Blk 2 Lot 5")!,
      amount: 1650,
      method: "GCASH",
      status: "PENDING",
      reference: "GC-8842194",
      submittedById: homeownerUser.id,
      note: "Paid via GCash this morning",
    },
  });
  await prisma.payment.create({
    data: {
      invoiceId: invoiceByUnit.get("Commercial Unit A")!,
      amount: 2500,
      method: "MAYA",
      status: "PENDING",
      reference: "MYA-55120",
      submittedById: homeownerUser.id,
    },
  });

  const firstProperty = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Blk 1 Lot 1" },
  });
  await prisma.gatePass.create({
    data: {
      code: generateGatePassCode(),
      propertyId: firstProperty.id,
      createdById: admin.id,
      visitorName: "Lalamove Rider",
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  await prisma.announcement.createMany({
    data: [
      {
        orgId: org.id,
        createdById: admin.id,
        title: "September dues are out",
        body: "Statements for September have been posted. Please settle on or before the 15th to avoid late notices. GCash and Maya are accepted through the portal.",
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        orgId: org.id,
        createdById: admin.id,
        title: "Water interruption — Saturday 6am–10am",
        body: "Maynilad has scheduled maintenance this Saturday. Please store water the night before.",
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        orgId: org.id,
        createdById: admin.id,
        title: "Draft: clubhouse repainting schedule",
        body: "Still finalizing dates with the contractor — will publish once confirmed.",
        publishedAt: null,
      },
    ],
  });

  console.log(`Seeded "${org.name}" (${org.subdomain})`);
  if (auth["admin@sample-hoa.ph"]) {
    console.log(`  logins (password: ${DEMO_PASSWORD}):`);
    for (const s of DEMO_STAFF) console.log(`    ${s.role.padEnd(12)} ${s.email}`);
    console.log(`    HOMEOWNER    ${DEMO_HOMEOWNER.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
