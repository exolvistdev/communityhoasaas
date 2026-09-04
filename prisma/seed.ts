import { PrismaClient } from "@prisma/client";
import {
  SEED_ACCOUNTS,
  postInvoiceIssued,
  postPaymentReceived,
  postManualEntry,
  postWriteOff,
  postFineIssued,
  postBillIssued,
  postBillPayment,
} from "../lib/ledger";
import { currentPeriod, shiftPeriod } from "../lib/format";
import { DEFAULT_WATER_BANDS } from "../lib/water";
import { recordReading, billReadings } from "../lib/water-billing";
import { generateGatePassCode } from "../lib/gatepass";
import { zonedInstant, zonedParts } from "../lib/amenity";
import { generateOverdueNotifications } from "../lib/notifications";
import { applyLateFees } from "../lib/late-fees";
import { deleteOrgCascade } from "../lib/org-teardown";
import {
  ensureMarketplaceBucket,
  uploadListingPhotos,
  MARKETPLACE_BUCKET,
} from "../lib/storage";
import {
  ensureDocumentsBucket,
  uploadDocument,
  clearOrgDocuments,
} from "../lib/documents";
import {
  ensurePaymentQrBucket,
  uploadPaymentQr,
  clearOrgPaymentQr,
} from "../lib/payment-qr";
import {
  ensureViolationPhotosBucket,
  clearOrgViolationPhotos,
} from "../lib/violation-photos";
import {
  ensureMaintenanceBucket,
  clearOrgMaintenancePhotos,
} from "../lib/maintenance-photos";
import { qrPngBase64 } from "../lib/qr";
import { createAdminClient } from "../lib/supabase/admin";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo-password-123";

const DEMO_STAFF = [
  { email: "admin@sample-hoa.ph", fullName: "Maria Santos", role: "ADMIN" as const },
  { email: "treasurer@sample-hoa.ph", fullName: "Ramon Cruz", role: "TREASURER" as const },
  { email: "board@sample-hoa.ph", fullName: "Elena Villanueva", role: "BOARD_MEMBER" as const },
  { email: "guard@sample-hoa.ph", fullName: "Boy Guard", role: "GUARD" as const },
];
// Homeowner logins, each linked below to the named person on their unit.
const DEMO_HOMEOWNERS = [
  {
    email: "juan@example.com",
    fullName: "Juan Dela Cruz",
    role: "HOMEOWNER" as const,
    unit: "Blk 1 Lot 1",
    person: "Juan Dela Cruz",
  },
  {
    email: "ana@example.com",
    fullName: "Ana Reyes",
    role: "HOMEOWNER" as const,
    unit: "Blk 1 Lot 2",
    person: "Ana Reyes",
  },
];
// Platform operator — belongs to no org; signs in at /platform/login.
const PLATFORM_ADMIN = {
  email: "superadmin@hoasaas.ph",
  fullName: "Platform Operator",
};

type SeededAuth = Record<string, string | null>; // email -> authId

/** Create matching Supabase auth users. No-ops (returns nulls) without a
 *  service-role key. */
async function createDemoAuthUsers(): Promise<SeededAuth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const all = [...DEMO_STAFF, ...DEMO_HOMEOWNERS, PLATFORM_ADMIN];
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
    people: [
      { fullName: "Marco Lim", role: "OWNER", isPrimary: true },
      // Juan also co-owns this townhouse — exercises the multi-unit switcher.
      { fullName: "Juan Dela Cruz", role: "CO_OWNER" },
    ],
  },
  {
    unitNumber: "Blk 2 Lot 5",
    type: "RESIDENTIAL",
    plan: null, // custom rate — exercises the no-plan path
    rate: 1650,
    people: [
      { fullName: "Grace Tan", role: "OWNER" },
      // Elena is on the board AND owns this unit — the dual-role case.
      { fullName: "Elena Villanueva", role: "CO_OWNER" },
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

/** Best-effort: drop every marketplace photo stored under an org's folder. */
async function clearOrgListingPhotos(orgId: string) {
  try {
    const storage = createAdminClient().storage.from(MARKETPLACE_BUCKET);
    const { data: folders } = await storage.list(orgId);
    for (const f of folders ?? []) {
      const { data: files } = await storage.list(`${orgId}/${f.name}`);
      const paths = (files ?? []).map((x) => `${orgId}/${f.name}/${x.name}`);
      if (paths.length) await storage.remove(paths);
    }
  } catch {
    /* best effort */
  }
}

/** Remove a previously-seeded demo org and all its rows, in FK order. */
async function resetDemoOrg() {
  const org = await prisma.organization.findUnique({
    where: { subdomain: "sample-hoa" },
  });
  if (!org) return;
  const orgId = org.id;
  await clearOrgListingPhotos(orgId);
  await clearOrgDocuments(orgId);
  await clearOrgPaymentQr(orgId);
  await clearOrgViolationPhotos(orgId);
  await clearOrgMaintenancePhotos(orgId);
  await deleteOrgCascade(prisma, orgId);
}

async function main() {
  // Hard stop: this drops and recreates the demo org. Never against production.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "Refusing to seed: NODE_ENV=production / VERCEL is set. The seed wipes the demo org."
    );
  }
  await resetDemoOrg();
  const auth = await createDemoAuthUsers();
  await ensureMarketplaceBucket().catch((e) =>
    console.log("  (marketplace bucket setup skipped:", e.message, ")")
  );
  await ensureDocumentsBucket().catch((e) =>
    console.log("  (documents bucket setup skipped:", e.message, ")")
  );
  await ensurePaymentQrBucket().catch((e) =>
    console.log("  (payment-qr bucket setup skipped:", e.message, ")")
  );
  await ensureViolationPhotosBucket().catch((e) =>
    console.log("  (violations bucket setup skipped:", e.message, ")")
  );
  await ensureMaintenanceBucket().catch((e) =>
    console.log("  (maintenance bucket setup skipped:", e.message, ")")
  );

  // Platform operator — decoupled from any org.
  await prisma.platformAdmin.deleteMany({ where: { email: PLATFORM_ADMIN.email } });
  if (auth[PLATFORM_ADMIN.email]) {
    await prisma.platformAdmin.create({
      data: {
        authId: auth[PLATFORM_ADMIN.email]!,
        email: PLATFORM_ADMIN.email,
        fullName: PLATFORM_ADMIN.fullName,
      },
    });
  }

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
      lateFeeEnabled: true,
      lateFeeType: "FIXED",
      lateFeeAmount: 200,
      lateFeeGraceDays: 3,
      lateFeeMaxOccurrences: 2,
      privacyContactEmail: "privacy@sample-hoa.ph",
      waterSource: "INTERNAL",
      // Default dues by property type (match the rate plans below).
      typeRateResidential: 1500,
      typeRateCommercial: 5000,
      typeRateTownhouse: 2200,
    },
  });

  // Fake wallet QR images so the Pay Now screen shows a real code (these encode
  // a note, not an actual payment target — a demo stand-in for an uploaded QR).
  for (const wallet of ["gcash", "maya"] as const) {
    try {
      const png = Buffer.from(
        await qrPngBase64(
          `Sample Subdivision HOA — ${wallet.toUpperCase()} 0917 555 0100`
        ),
        "base64"
      );
      const path = await uploadPaymentQr(
        new File([png], `${wallet}.png`, { type: "image/png" }),
        { orgId: org.id, wallet }
      );
      if (path)
        await prisma.organization.update({
          where: { id: org.id },
          data: { [wallet === "gcash" ? "gcashQrPath" : "mayaQrPath"]: path },
        });
    } catch (e) {
      console.log(`  (seed ${wallet} QR skipped:`, (e as Error).message, ")");
    }
  }

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
  const homeownerUsers = new Map<string, { id: string }>();
  for (const h of DEMO_HOMEOWNERS) {
    const u = await prisma.user.create({
      data: {
        orgId: org.id,
        authId: auth[h.email],
        email: h.email,
        fullName: h.fullName,
        role: h.role,
        acceptedAt: new Date(),
      },
    });
    homeownerUsers.set(h.email, u);
  }
  const homeownerUser = homeownerUsers.get("juan@example.com")!;
  const anaUser = homeownerUsers.get("ana@example.com")!;
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

    // Blk 1 Lot 2 overpaid (₱500 carried as resident credit); Blk 1 Lot 3
    // partial; the rest outstanding (Blk 1 Lot 1 is the demo homeowner login —
    // left owing on purpose).
    if (i === 1) {
      const pay = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: p.rate + 500, // overpayment → resident credit
          method: "GCASH",
          status: "CONFIRMED",
          confirmedById: admin.id,
          confirmedAt: new Date(),
          allocations: { create: [{ invoiceId: invoice.id, amount: p.rate }] },
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
          allocations: { create: [{ invoiceId: invoice.id, amount: 1000 }] },
        },
      });
      await postPaymentReceived(pay.id);
    }
  }

  // A prior-month overdue invoice for Blk 1 Lot 1 (demo homeowner login).
  {
    const blk1lot1 = await prisma.property.findFirstOrThrow({
      where: { orgId: org.id, unitNumber: "Blk 1 Lot 1" },
    });
    const priorPeriod = `${y}-${String(m - 1).padStart(2, "0")}`;
    const priorInvoice = await prisma.invoice.create({
      data: {
        propertyId: blk1lot1.id,
        amount: blk1lot1.monthlyRate,
        period: priorPeriod,
        dueDate: new Date(y, m - 2, 15),
        status: "SENT",
        memo: `Monthly dues — ${priorPeriod}`,
      },
    });
    await postInvoiceIssued(priorInvoice.id);
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

  // Blk 3 Lot 9 was vacated ~a month ago owing ₱1,500, which was written off.
  {
    const movedOut = await prisma.property.findFirstOrThrow({
      where: { orgId: org.id, unitNumber: "Blk 3 Lot 9" },
    });
    const oldPeriod = `${y}-${String(m - 2).padStart(2, "0")}`;
    const staleInvoice = await prisma.invoice.create({
      data: {
        propertyId: movedOut.id,
        amount: 1500,
        period: oldPeriod,
        dueDate: new Date(y, m - 3, 15),
        status: "SENT",
        memo: `Monthly dues — ${oldPeriod}`,
      },
    });
    await postInvoiceIssued(staleInvoice.id);
    const writtenOff = await prisma.payment.create({
      data: {
        invoiceId: staleInvoice.id,
        amount: 1500,
        method: "WRITE_OFF",
        status: "CONFIRMED",
        paidAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        confirmedById: admin.id,
        confirmedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        note: "Written off on close-out — unit vacated",
      },
    });
    await postWriteOff(writtenOff.id);
    await prisma.ownershipTransfer.create({
      data: {
        orgId: org.id,
        propertyId: movedOut.id,
        previousOwnerName: "Former Owner",
        vacated: true,
        finalBalance: 1500,
        settlement: "WRITTEN_OFF",
        effectiveDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        handledById: admin.id,
        note: "Unit vacated; balance uncollectible.",
      },
    });
  }

  // Link each demo homeowner login to the named person on their unit.
  for (const h of DEMO_HOMEOWNERS) {
    const record = await prisma.homeowner.findFirstOrThrow({
      where: {
        property: { orgId: org.id, unitNumber: h.unit },
        fullName: h.person,
      },
    });
    await prisma.homeowner.update({
      where: { id: record.id },
      data: { userId: homeownerUsers.get(h.email)!.id },
    });
  }

  // Juan is a co-owner on Blk 1 Lot 3 too — one login, two units.
  const juanLot3 = await prisma.homeowner.findFirstOrThrow({
    where: {
      property: { orgId: org.id, unitNumber: "Blk 1 Lot 3" },
      fullName: "Juan Dela Cruz",
    },
  });
  await prisma.homeowner.update({
    where: { id: juanLot3.id },
    data: { userId: homeownerUsers.get("juan@example.com")!.id },
  });

  // Elena (a board member) also owns Blk 2 Lot 5 — staff + resident dual role.
  const elenaUser = await prisma.user.findFirstOrThrow({
    where: { orgId: org.id, email: "board@sample-hoa.ph" },
  });
  const elenaRow = await prisma.homeowner.findFirstOrThrow({
    where: {
      property: { orgId: org.id, unitNumber: "Blk 2 Lot 5" },
      fullName: "Elena Villanueva",
    },
  });
  await prisma.homeowner.update({
    where: { id: elenaRow.id },
    data: { userId: elenaUser.id },
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
  const lot2 = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Blk 1 Lot 2" },
  });
  const guard = await prisma.user.findFirstOrThrow({
    where: { orgId: org.id, role: "GUARD" },
  });
  const HOUR = 60 * 60 * 1000;

  // Known codes so the guard portal is demoable: VALID, EXPIRED, REVOKED.
  const validPass = await prisma.gatePass.create({
    data: {
      code: "VALID123",
      propertyId: firstProperty.id,
      createdById: admin.id,
      visitorName: "Lalamove Rider",
      validFrom: new Date(Date.now() - HOUR),
      validUntil: new Date(Date.now() + 4 * HOUR),
    },
  });
  await prisma.gatePass.create({
    data: {
      code: "EXPIRED9",
      propertyId: firstProperty.id,
      createdById: admin.id,
      visitorName: "Grab Driver",
      validFrom: new Date(Date.now() - 6 * HOUR),
      validUntil: new Date(Date.now() - 2 * HOUR),
    },
  });
  await prisma.gatePass.create({
    data: {
      code: "REVOKED7",
      propertyId: lot2.id,
      createdById: admin.id,
      visitorName: "Unknown Contractor",
      validFrom: new Date(Date.now() - HOUR),
      validUntil: new Date(Date.now() + 4 * HOUR),
      status: "REVOKED",
    },
  });
  await prisma.gatePassScan.createMany({
    data: [
      {
        orgId: org.id,
        gatePassId: validPass.id,
        code: "VALID123",
        result: "VALID",
        scannedById: guard.id,
        scannedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      {
        orgId: org.id,
        gatePassId: null,
        code: "ZZZZ999",
        result: "NOT_FOUND",
        scannedById: guard.id,
        scannedAt: new Date(Date.now() - 25 * 60 * 1000),
      },
    ],
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

  // ── Document library ──────────────────────────────────────────────
  // A minimal valid PDF so the Storage upload/serve path is exercised.
  const pdfBytes = Buffer.from(
    "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTc4CiUlRU9GCg==",
    "base64"
  );
  const seedDoc = async (meta: {
    title: string;
    description: string;
    category:
      | "BYLAWS"
      | "BOARD_MINUTES"
      | "FINANCIAL_STATEMENT"
      | "FORM"
      | "POLICY"
      | "NEWSLETTER"
      | "OTHER";
    staffOnly?: boolean;
    fileName: string;
  }) => {
    try {
      const up = await uploadDocument(
        new File([pdfBytes], meta.fileName, { type: "application/pdf" }),
        { orgId: org.id }
      );
      if (!up) return;
      await prisma.document.create({
        data: {
          orgId: org.id,
          title: meta.title,
          description: meta.description,
          category: meta.category,
          staffOnly: meta.staffOnly ?? false,
          storagePath: up.storagePath,
          fileName: up.fileName,
          mimeType: up.mimeType,
          sizeBytes: up.sizeBytes,
          uploadedById: admin.id,
        },
      });
    } catch (e) {
      console.log("  (seed document skipped:", (e as Error).message, ")");
    }
  };
  await seedDoc({
    title: "HOA Bylaws (2023 revision)",
    description: "Governing document adopted at the 2023 general assembly.",
    category: "BYLAWS",
    fileName: "hoa-bylaws-2023.pdf",
  });
  await seedDoc({
    title: "Audited financial statements — 2025",
    description: "Year-end statement of financial position and income & expenses.",
    category: "FINANCIAL_STATEMENT",
    fileName: "fs-2025.pdf",
  });
  await seedDoc({
    title: "Board meeting minutes — August 2026",
    description: "Draft minutes pending board approval.",
    category: "BOARD_MINUTES",
    staffOnly: true,
    fileName: "minutes-2026-08.pdf",
  });

  // ── Resident marketplace ──────────────────────────────────────────
  const DAY = 24 * 60 * 60 * 1000;
  const mkListing = (
    seller: { id: string },
    data: {
      title: string;
      description: string;
      category:
        | "FURNITURE"
        | "APPLIANCES"
        | "ELECTRONICS"
        | "HOME_GARDEN"
        | "VEHICLES"
        | "CLOTHING"
        | "KIDS"
        | "SERVICES"
        | "OTHER";
      price: number;
      expiresInDays?: number;
    }
  ) => {
    const { expiresInDays = 30, ...rest } = data;
    return prisma.marketplaceListing.create({
      data: {
        orgId: org.id,
        sellerId: seller.id,
        photos: [],
        expiresAt: new Date(Date.now() + expiresInDays * DAY),
        ...rest,
      },
    });
  };

  const mattress = await mkListing(homeownerUser, {
    title: "Uratex foam mattress — double size",
    description:
      "Selling our double-size Uratex foam mattress, about 2 years old, used in the guest room only. No stains, no bed bugs. Pick up at Blk 1 Lot 1.",
    category: "FURNITURE",
    price: 3500,
    expiresInDays: 3, // nearly expired — demos the Renew nudge
  });
  await mkListing(homeownerUser, {
    title: "1.0HP window-type aircon (Carrier)",
    description:
      "Carrier 1.0HP window-type unit, cools a small bedroom fast. Recently cleaned and vacuumed. Some scratches on the casing. Bring your own tools for uninstall.",
    category: "APPLIANCES",
    price: 6500,
  });
  const bike = await mkListing(anaUser, {
    title: "Kids' mountain bike — 20-inch",
    description:
      "20-inch kids' mountain bike, 6-speed. My daughter outgrew it. Tires still good, brakes recently adjusted. Minor rust on the kickstand.",
    category: "KIDS",
    price: 2800,
  });
  await mkListing(anaUser, {
    title: "Math tutoring — high school & college",
    description:
      "Licensed teacher offering weekend math tutoring (algebra, trig, calculus). Sessions at the clubhouse or your unit. ₱400/hour, package rates available.",
    category: "SERVICES",
    price: 400,
  });

  // A real photo, to exercise the Storage upload/serve path.
  try {
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const paths = await uploadListingPhotos(
      [new File([pngBytes], "mattress.png", { type: "image/png" })],
      { orgId: org.id, listingId: mattress.id }
    );
    if (paths.length)
      await prisma.marketplaceListing.update({
        where: { id: mattress.id },
        data: { photos: paths },
      });
  } catch (e) {
    console.log("  (seed listing photo skipped:", (e as Error).message, ")");
  }

  // Ana is interested in Juan's mattress — a live thread with one unread reply.
  const convo = await prisma.marketConversation.create({
    data: {
      orgId: org.id,
      listingId: mattress.id,
      buyerId: anaUser.id,
      sellerId: homeownerUser.id,
      lastMessageAt: new Date(Date.now() - 20 * 60 * 1000),
    },
  });
  await prisma.marketMessage.createMany({
    data: [
      {
        conversationId: convo.id,
        senderId: anaUser.id,
        body: "Hi! Is the mattress still available? Any stains or sagging?",
        readAt: new Date(Date.now() - 90 * 60 * 1000),
        createdAt: new Date(Date.now() - 120 * 60 * 1000),
      },
      {
        conversationId: convo.id,
        senderId: homeownerUser.id,
        body: "Yes, still available! No stains, no sagging — guest room only. You can view it anytime this week.",
        readAt: new Date(Date.now() - 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 80 * 60 * 1000),
      },
      {
        conversationId: convo.id,
        senderId: anaUser.id,
        body: "Great, I'll drop by Saturday morning if that works for you.",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    ],
  });

  // A reported listing so the moderation view has something to act on.
  const aircon = await prisma.marketplaceListing.findFirstOrThrow({
    where: { orgId: org.id, title: { startsWith: "1.0HP window-type" } },
  });
  await prisma.listingReport.create({
    data: {
      listingId: aircon.id,
      reporterId: anaUser.id,
      reason:
        "Price looks too low for a working Carrier unit — worried it might be misleading or already broken.",
    },
  });

  // A second thread (Juan asking about Ana's bike) that Ana then reports —
  // gives the conversation-moderation view something to act on.
  const bikeConvo = await prisma.marketConversation.create({
    data: {
      orgId: org.id,
      listingId: bike.id,
      buyerId: homeownerUser.id,
      sellerId: anaUser.id,
      lastMessageAt: new Date(Date.now() - 10 * 60 * 1000),
      messages: {
        create: [
          {
            senderId: homeownerUser.id,
            body: "Will you take 1500 for the bike? Cash today.",
            createdAt: new Date(Date.now() - 15 * 60 * 1000),
          },
          {
            senderId: homeownerUser.id,
            body: "Hello? 1500 final. Don't waste my time.",
            createdAt: new Date(Date.now() - 10 * 60 * 1000),
          },
        ],
      },
    },
  });
  await prisma.conversationReport.create({
    data: {
      conversationId: bikeConvo.id,
      reporterId: anaUser.id,
      reason: "Buyer is being rude and pushy after I said the price was firm.",
    },
  });

  // ── Amenity booking ───────────────────────────────────────────────
  const hall = await prisma.amenity.create({
    data: {
      orgId: org.id,
      name: "Clubhouse Function Hall",
      description:
        "Air-conditioned hall, seats ~60. Tables and chairs included; bring your own decor and caterer.",
      fee: 2000,
      feeNote: "+ ₱3,000 refundable deposit, settled at the HOA office",
      capacity: 1,
      openHour: 8,
      closeHour: 22,
      minNoticeHours: 24,
      maxHours: 6,
      cancellationCutoffHours: 72,
      requiresApproval: true,
    },
  });
  await prisma.amenity.create({
    data: {
      orgId: org.id,
      name: "Basketball Court",
      description: "Half-court with lights. First come, first served after hours.",
      fee: 0,
      capacity: 1,
      openHour: 6,
      closeHour: 22,
      minNoticeHours: 2,
      maxHours: 2,
      cancellationCutoffHours: 24,
      requiresApproval: false,
    },
  });

  const court = await prisma.amenity.findFirstOrThrow({
    where: { orgId: org.id, name: "Basketball Court" },
  });

  // All amenity times are the HOA's wall-clock (Asia/Manila), regardless of
  // where the seed runs.
  const nowParts = zonedParts(new Date());
  const at = (daysFromNow: number, hour: number) =>
    zonedInstant(nowParts.year, nowParts.month, nowParts.day + daysFromNow, hour);
  const dow = new Date(
    Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)
  ).getUTCDay(); // 0=Sun … 6=Sat
  const daysToSat = Math.max(((6 - dow) % 7) || 7, 3); // next Sat, ≥3 days out

  // Juan — confirmed court booking tomorrow evening (auto-confirm, no fee).
  await prisma.amenityBooking.create({
    data: {
      orgId: org.id,
      amenityId: court.id,
      requesterId: homeownerUser.id,
      propertyId: firstProperty.id,
      startAt: at(1, 18),
      endAt: at(1, 20),
      status: "CONFIRMED",
      purpose: "Evening practice",
      decidedById: admin.id,
      decidedAt: new Date(),
    },
  });

  // Ana — pending hall request for the coming Saturday (fills the admin queue).
  await prisma.amenityBooking.create({
    data: {
      orgId: org.id,
      amenityId: hall.id,
      requesterId: anaUser.id,
      propertyId: lot2.id,
      startAt: at(daysToSat, 14),
      endAt: at(daysToSat, 20),
      status: "PENDING",
      purpose: "Daughter's christening reception",
    },
  });

  // Juan — a past confirmed hall booking whose ₱2,000 fee was invoiced and paid.
  const pastHall = await prisma.amenityBooking.create({
    data: {
      orgId: org.id,
      amenityId: hall.id,
      requesterId: homeownerUser.id,
      propertyId: firstProperty.id,
      startAt: at(-12, 15),
      endAt: at(-12, 21),
      status: "CONFIRMED",
      purpose: "Birthday party",
      decidedById: admin.id,
      decidedAt: at(-14, 9),
    },
  });
  const hallInvoice = await prisma.invoice.create({
    data: {
      propertyId: firstProperty.id,
      amount: 2000,
      period: null,
      dueDate: at(-12, 15),
      status: "SENT",
      memo: "Amenity — Clubhouse Function Hall (birthday party)",
    },
  });
  await postInvoiceIssued(hallInvoice.id);
  await prisma.amenityBooking.update({
    where: { id: pastHall.id },
    data: { invoiceId: hallInvoice.id },
  });
  const hallPay = await prisma.payment.create({
    data: {
      invoiceId: hallInvoice.id,
      amount: 2000,
      method: "GCASH",
      status: "CONFIRMED",
      confirmedById: admin.id,
      confirmedAt: at(-13, 10),
      allocations: { create: [{ invoiceId: hallInvoice.id, amount: 2000 }] },
    },
  });
  await postPaymentReceived(hallPay.id);

  // ── Manual ledger entries: opening balance + a few operating costs ──
  const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await postManualEntry({
    orgId: org.id,
    entryDate: ago(300),
    memo: "Opening cash balance",
    createdById: admin.id,
    lines: [
      { code: "1000", debit: 80000, credit: 0 },
      { code: "3900", debit: 0, credit: 80000 },
    ],
  });
  await postManualEntry({
    orgId: org.id,
    entryDate: ago(40),
    memo: "August security services",
    createdById: admin.id,
    lines: [
      { code: "5300", debit: 12000, credit: 0 },
      { code: "1000", debit: 0, credit: 12000 },
    ],
  });
  await postManualEntry({
    orgId: org.id,
    entryDate: ago(35),
    memo: "Common-area electricity & water",
    createdById: admin.id,
    lines: [
      { code: "5100", debit: 4200, credit: 0 },
      { code: "1000", debit: 0, credit: 4200 },
    ],
  });
  await postManualEntry({
    orgId: org.id,
    entryDate: ago(18),
    memo: "Main gate motor repair",
    createdById: admin.id,
    lines: [
      { code: "5200", debit: 3500, credit: 0 },
      { code: "1000", debit: 0, credit: 3500 },
    ],
  });
  await postManualEntry({
    orgId: org.id,
    entryDate: ago(12),
    memo: "Bank interest",
    createdById: admin.id,
    lines: [
      { code: "1000", debit: 850, credit: 0 },
      { code: "4200", debit: 0, credit: 850 },
    ],
  });

  // ── Data-privacy request (RA 10173) ──────────────────────────────
  await prisma.dataRequest.create({
    data: {
      orgId: org.id,
      userId: anaUser.id,
      type: "DELETION",
      reason: "We're selling the unit and moving out of the country.",
    },
  });

  // ── Violations & fines ───────────────────────────────────────────
  const commercialUnit = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Commercial Unit A" },
  });

  // Open parking violation on Juan's unit, with a ₱500 fine already served.
  const parking = await prisma.violation.create({
    data: {
      orgId: org.id,
      propertyId: firstProperty.id,
      reportedById: admin.id,
      category: "PARKING",
      description:
        "Vehicle parked in the visitor bay overnight on three occasions this week. Please use your assigned slot.",
      status: "OPEN",
      occurredAt: ago(6),
      cureByDate: at(7, 12),
    },
  });
  {
    const dueDate = at(14, 12);
    const fineInvoice = await prisma.invoice.create({
      data: {
        propertyId: firstProperty.id,
        amount: 500,
        period: null,
        dueDate,
        status: "SENT",
        memo: "Fine — Blk 1 Lot 1 — Parking (notice 1)",
      },
    });
    await postFineIssued(fineInvoice.id);
    await prisma.fineNotice.create({
      data: {
        violationId: parking.id,
        orgId: org.id,
        noticeNumber: 1,
        amount: 500,
        invoiceId: fineInvoice.id,
        issuedById: admin.id,
        issuedAt: ago(3),
        dueDate,
        note: "First notice — repeated visitor-bay parking.",
      },
    });
  }

  // A resolved waste violation on the commercial unit — no fine.
  await prisma.violation.create({
    data: {
      orgId: org.id,
      propertyId: commercialUnit.id,
      reportedById: admin.id,
      category: "WASTE",
      description: "Commercial waste left outside the designated collection window.",
      status: "CURED",
      occurredAt: ago(25),
      resolvedAt: ago(20),
      resolutionNote: "Tenant switched to the scheduled private hauler.",
    },
  });

  // ── Vendors & bills (accounts payable) ───────────────────────────
  const security = await prisma.vendor.create({
    data: {
      orgId: org.id,
      name: "Metro Guard Security Services",
      contactName: "Rick Ocampo",
      email: "billing@metroguard.ph",
      phone: "0917 222 0100",
    },
  });
  const landscaping = await prisma.vendor.create({
    data: {
      orgId: org.id,
      name: "GreenScape Landscaping",
      contactName: "Malou Fernandez",
      phone: "0918 444 0200",
      notes: "Weekly common-area maintenance; invoices monthly.",
    },
  });

  const mkBill = async (
    vendorId: string,
    data: {
      description: string;
      amount: number;
      code: string;
      billDaysAgo: number;
      dueInDays: number; // relative to bill date
      billNumber?: string;
    }
  ) => {
    const billDate = ago(data.billDaysAgo);
    const bill = await prisma.bill.create({
      data: {
        orgId: org.id,
        vendorId,
        billNumber: data.billNumber ?? null,
        description: data.description,
        amount: data.amount,
        billDate,
        dueDate: new Date(billDate.getTime() + data.dueInDays * 24 * 60 * 60 * 1000),
        status: "UNPAID",
        expenseAccountCode: data.code,
        createdById: admin.id,
      },
    });
    await postBillIssued(bill.id);
    return bill;
  };

  const paidBill = await mkBill(security.id, {
    description: "August guard services (3 posts)",
    amount: 12000,
    code: "5300",
    billDaysAgo: 35,
    dueInDays: 15,
    billNumber: "MG-2608",
  });
  {
    const bp = await prisma.billPayment.create({
      data: {
        billId: paidBill.id,
        amount: 12000,
        method: "BANK_TRANSFER",
        reference: "BDO-778120",
        paidAt: ago(18),
        recordedById: admin.id,
      },
    });
    await postBillPayment(bp.id);
  }

  const partialBill = await mkBill(landscaping.id, {
    description: "August common-area landscaping",
    amount: 4500,
    code: "5000",
    billDaysAgo: 30,
    dueInDays: 15, // due ~15 days ago → overdue
  });
  {
    const bp = await prisma.billPayment.create({
      data: {
        billId: partialBill.id,
        amount: 2000,
        method: "GCASH",
        paidAt: ago(10),
        recordedById: admin.id,
      },
    });
    await postBillPayment(bp.id);
  }

  await mkBill(landscaping.id, {
    description: "September common-area landscaping",
    amount: 4500,
    code: "5000",
    billDaysAgo: 3,
    dueInDays: 15,
  });

  // ── Maintenance / work orders ────────────────────────────────────
  const plumbing = await prisma.maintenanceRequest.create({
    data: {
      orgId: org.id,
      propertyId: firstProperty.id,
      requesterId: homeownerUser.id,
      category: "PLUMBING",
      title: "Kitchen sink draining slowly",
      description:
        "The kitchen sink has been draining very slowly for about a week and now barely drains at all. Tried a plunger, no luck.",
      location: "Kitchen, under the sink",
      status: "IN_PROGRESS",
      assignedToId: admin.id,
    },
  });
  await prisma.maintenanceComment.createMany({
    data: [
      {
        requestId: plumbing.id,
        authorId: admin.id,
        body: "Thanks for reporting. We've scheduled a plumber for Thursday morning — please make sure someone can let them in.",
        staffOnly: false,
        createdAt: ago(2),
      },
      {
        requestId: plumbing.id,
        authorId: homeownerUser.id,
        body: "Thursday works, someone will be home from 8am.",
        staffOnly: false,
        createdAt: ago(1),
      },
      {
        requestId: plumbing.id,
        authorId: admin.id,
        body: "Vendor quote is ₱1,800 for rodding — within the ceiling, proceeding.",
        staffOnly: true,
        createdAt: ago(1),
      },
    ],
  });

  await prisma.maintenanceRequest.create({
    data: {
      orgId: org.id,
      propertyId: lot2.id,
      requesterId: anaUser.id,
      category: "ELECTRICAL",
      title: "Hallway light flickering",
      description:
        "The light in the entry hallway flickers whenever the aircon turns on. Might be a wiring issue.",
      status: "OPEN",
    },
  });

  const gate = await prisma.maintenanceRequest.create({
    data: {
      orgId: org.id,
      requesterId: elenaUser.id,
      isCommonArea: true,
      category: "SECURITY",
      title: "Pedestrian gate latch broken",
      description:
        "The side pedestrian gate latch doesn't catch — the gate swings open on its own.",
      location: "Side entrance near the guardhouse",
      status: "RESOLVED",
      assignedToId: admin.id,
      resolvedAt: ago(4),
    },
  });
  await prisma.maintenanceComment.create({
    data: {
      requestId: gate.id,
      authorId: admin.id,
      body: "Latch replaced and the gate re-hung. Please report again if it drifts.",
      staffOnly: false,
      createdAt: ago(4),
    },
  });

  // ── Board meetings ───────────────────────────────────────────────
  const upcomingMeeting = await prisma.boardMeeting.create({
    data: {
      orgId: org.id,
      createdById: elenaUser.id,
      title: "Q4 board meeting",
      scheduledAt: at(9, 19), // ~9 days out, 7pm Manila
      location: "Clubhouse function hall",
      agenda:
        "1. Approval of the previous minutes\n2. Treasurer's report (Q3)\n3. Landscaping contract renewal\n4. Proposed 2027 dues schedule\n5. Open forum",
    },
  });
  await prisma.meetingRsvp.createMany({
    data: [
      { meetingId: upcomingMeeting.id, userId: homeownerUser.id, response: "YES" },
      {
        meetingId: upcomingMeeting.id,
        userId: anaUser.id,
        response: "MAYBE",
        note: "May be a few minutes late.",
      },
      { meetingId: upcomingMeeting.id, userId: elenaUser.id, response: "YES" },
    ],
  });

  const pastMeeting = await prisma.boardMeeting.create({
    data: {
      orgId: org.id,
      createdById: elenaUser.id,
      title: "Special meeting — perimeter fence repair",
      scheduledAt: ago(21),
      location: "Clubhouse",
      agenda:
        "1. Review of contractor quotes for the perimeter fence\n2. Vote on the awarded contractor\n3. Assessment schedule",
      status: "HELD",
    },
  });
  try {
    const up = await uploadDocument(
      new File([pdfBytes], "minutes-special-fence.pdf", { type: "application/pdf" }),
      { orgId: org.id }
    );
    if (up) {
      const minutesDoc = await prisma.document.create({
        data: {
          orgId: org.id,
          title: `Minutes — ${pastMeeting.title}`,
          description: "Board meeting held three weeks ago.",
          category: "BOARD_MINUTES",
          staffOnly: false,
          storagePath: up.storagePath,
          fileName: up.fileName,
          mimeType: up.mimeType,
          sizeBytes: up.sizeBytes,
          uploadedById: admin.id,
        },
      });
      await prisma.boardMeeting.update({
        where: { id: pastMeeting.id },
        data: { minutesDocumentId: minutesDoc.id },
      });
    }
  } catch (e) {
    console.log("  (seed meeting minutes skipped:", (e as Error).message, ")");
  }

  // ── Votes (RA 9904) ─────────────────────────────────────────────
  const voteLot1 = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Blk 1 Lot 1" },
  });
  const voteLot2 = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Blk 1 Lot 2" },
  });
  const voteLot5 = await prisma.property.findFirstOrThrow({
    where: { orgId: org.id, unitNumber: "Blk 2 Lot 5" },
  });

  const budgetVote = await prisma.boardVote.create({
    data: {
      orgId: org.id,
      createdById: elenaUser.id,
      title: "Approve the 2027 operating budget",
      description:
        "The board proposes the 2027 budget, which raises monthly dues by ₱150 to fund the perimeter fence repair and expanded security coverage.\n\nA yes vote adopts the budget effective January 2027.",
      status: "OPEN",
      opensAt: ago(3),
      closesAt: at(4, 17),
      quorumPct: 40,
      threshold: "MAJORITY",
    },
  });
  const anaProxy = await prisma.voteProxy.create({
    data: {
      orgId: org.id,
      grantorPropertyId: voteLot2.id,
      holderUserId: homeownerUser.id,
      grantedById: anaUser.id,
      note: "Away for the voting window — Juan to cast on my behalf.",
    },
  });
  await prisma.ballot.createMany({
    data: [
      {
        voteId: budgetVote.id,
        propertyId: voteLot1.id,
        choice: "YES",
        castById: homeownerUser.id,
      },
      {
        voteId: budgetVote.id,
        propertyId: voteLot2.id,
        choice: "NO",
        castById: homeownerUser.id,
        viaProxyForId: anaProxy.id,
      },
      {
        voteId: budgetVote.id,
        propertyId: voteLot5.id,
        choice: "YES",
        castById: elenaUser.id,
      },
    ],
  });

  const parkingVote = await prisma.boardVote.create({
    data: {
      orgId: org.id,
      createdById: elenaUser.id,
      title: "Ratify the amended parking rules",
      description:
        "Amendment to §12 of the house rules restricting street parking to registered vehicles with a valid sticker. Requires a two-thirds vote.",
      status: "CLOSED",
      opensAt: ago(20),
      closesAt: ago(10),
      quorumPct: 30,
      threshold: "TWO_THIRDS",
    },
  });
  await prisma.ballot.createMany({
    data: [
      { voteId: parkingVote.id, propertyId: voteLot1.id, choice: "YES", castById: homeownerUser.id },
      { voteId: parkingVote.id, propertyId: voteLot2.id, choice: "YES", castById: anaUser.id },
      { voteId: parkingVote.id, propertyId: voteLot5.id, choice: "ABSTAIN", castById: elenaUser.id },
    ],
  });
  try {
    const up = await uploadDocument(
      new File([pdfBytes], "vote-result-parking-rules.pdf", { type: "application/pdf" }),
      { orgId: org.id }
    );
    if (up) {
      const doc = await prisma.document.create({
        data: {
          orgId: org.id,
          title: `Vote result — ${parkingVote.title}`,
          description: "Voting closed ten days ago.",
          category: "BOARD_MINUTES",
          staffOnly: false,
          storagePath: up.storagePath,
          fileName: up.fileName,
          mimeType: up.mimeType,
          sizeBytes: up.sizeBytes,
          uploadedById: admin.id,
        },
      });
      await prisma.boardVote.update({
        where: { id: parkingVote.id },
        data: { resultDocumentId: doc.id },
      });
    }
  } catch (e) {
    console.log("  (seed vote result skipped:", (e as Error).message, ")");
  }

  // ── Board of Trustees election (RA 9904) ───────────────────────
  {
    const lot3 = await prisma.property.findFirstOrThrow({
      where: { orgId: org.id, unitNumber: "Blk 1 Lot 3" },
    });
    const owners = Object.fromEntries(
      await Promise.all(
        [voteLot1, voteLot2, lot3, voteLot5].map(async (p) => [
          p.id,
          await prisma.homeowner.findFirstOrThrow({
            where: { propertyId: p.id, isPrimary: true },
          }),
        ])
      )
    ) as Record<string, { id: string; fullName: string }>;

    const election = await prisma.election.create({
      data: {
        orgId: org.id,
        createdById: elenaUser.id,
        title: "2026 Board of Trustees Election",
        description:
          "Elect three trustees to the Board for a one-year term. Each unit's ballot may endorse up to three candidates; the three with the most votes are seated.",
        seats: 3,
        status: "CLOSED",
        opensAt: ago(25),
        closesAt: ago(12),
        quorumPct: 30,
        termMonths: 12,
        finalizedAt: ago(11),
      },
    });

    const candidates = await Promise.all(
      [
        { p: voteLot1, bio: "Incumbent chair. Ran the perimeter-fence project." },
        { p: voteLot2, bio: "Treasurer nominee — CPA, wants monthly financials posted." },
        { p: lot3, bio: "New homeowner, focus on the playground and green space." },
        { p: voteLot5, bio: "Long-time resident, security committee." },
      ].map((c) =>
        prisma.electionCandidate.create({
          data: {
            electionId: election.id,
            homeownerId: owners[c.p.id].id,
            name: owners[c.p.id].fullName,
            bio: c.bio,
          },
        })
      )
    );

    // ballots — top 3 (candidates[0..2]) win
    const ballotPicks: [typeof voteLot1, number[]][] = [
      [voteLot1, [0, 1, 2]],
      [voteLot2, [0, 1, 3]],
      [lot3, [1, 2]],
      [voteLot5, [0, 2]],
    ];
    for (const [p, picks] of ballotPicks) {
      const b = await prisma.electionBallot.create({
        data: { electionId: election.id, propertyId: p.id },
      });
      for (const i of picks)
        await prisma.electionVote.create({
          data: { ballotId: b.id, candidateId: candidates[i].id },
        });
    }

    // seat the three winners (candidates 0, 1, 2)
    const termStart = ago(12);
    const termEnd = new Date(termStart);
    termEnd.setMonth(termEnd.getMonth() + 12);
    for (const [idx, position] of [
      [0, "CHAIRPERSON"],
      [1, "TREASURER"],
      [2, "MEMBER"],
    ] as const) {
      const c = candidates[idx];
      const owner = await prisma.homeowner.findUniqueOrThrow({
        where: { id: c.homeownerId! },
        select: { userId: true },
      });
      await prisma.trustee.create({
        data: {
          orgId: org.id,
          electionId: election.id,
          homeownerId: c.homeownerId,
          userId: owner.userId,
          name: c.name,
          position,
          termStart,
          termEnd,
        },
      });
    }
  }

  // ── Water sub-metering ──────────────────────────────────────────
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      waterBillingEnabled: true,
      waterServiceCharge: 150,
      waterRateBands: DEFAULT_WATER_BANDS as unknown as object,
    },
  });
  const meterUnits = [
    { unit: "Blk 1 Lot 1", prior: 1420, current: 1438 }, // 18 m³
    { unit: "Blk 1 Lot 2", prior: 980, current: 989 }, //  9 m³
    { unit: "Blk 1 Lot 3", prior: 2210, current: 2245 }, // 35 m³
    { unit: "Blk 2 Lot 5", prior: 640, current: 652 }, // 12 m³
  ];
  const priorMonth = shiftPeriod(currentPeriod(), -1);
  for (const mu of meterUnits) {
    const prop = await prisma.property.findFirstOrThrow({
      where: { orgId: org.id, unitNumber: mu.unit },
    });
    const meter = await prisma.waterMeter.create({
      data: { orgId: org.id, propertyId: prop.id, installedAt: ago(400) },
    });
    await recordReading({
      meterId: meter.id,
      period: priorMonth,
      readingDate: ago(30),
      currentReading: mu.current,
      priorOverride: mu.prior, // meter's installed baseline
    });
  }
  await billReadings(org.id, priorMonth, admin.id);

  // ── Notifications ─────────────────────────────────────────────────
  const nDay = 24 * 60 * 60 * 1000;
  await prisma.notification.createMany({
    data: [
      {
        userId: homeownerUser.id,
        type: "DUES_ISSUED",
        title: "September 2026 dues are ready",
        body: "Your statement for September 2026 is posted. Due 15 September 2026.",
        href: "/portal",
        readAt: new Date(Date.now() - 2 * nDay),
        createdAt: new Date(Date.now() - 3 * nDay),
      },
      {
        userId: homeownerUser.id,
        type: "PAYMENT_CONFIRMED",
        title: "Payment confirmed — Blk 1 Lot 1",
        body: "Your ₱2,000 payment was confirmed and applied to your account.",
        href: "/portal",
        readAt: new Date(Date.now() - 12 * nDay),
        createdAt: new Date(Date.now() - 13 * nDay),
      },
      {
        userId: homeownerUser.id,
        type: "ANNOUNCEMENT",
        title: "Water interruption — Saturday 6am–10am",
        body: "Maynilad has scheduled maintenance this Saturday. Please store water the night before.",
        href: "/portal/announcements",
        createdAt: new Date(Date.now() - 1 * nDay),
      },
    ],
  });
  // Juan's prior-month invoice is past due → one INVOICE_OVERDUE (unread).
  await generateOverdueNotifications(org.id);
  // …and the same overdue invoice picks up a ₱200 late fee.
  await applyLateFees(org.id);

  console.log(`Seeded "${org.name}" (${org.subdomain})`);
  if (auth["admin@sample-hoa.ph"]) {
    console.log(`  logins (password: ${DEMO_PASSWORD}):`);
    for (const s of DEMO_STAFF) console.log(`    ${s.role.padEnd(12)} ${s.email}`);
    for (const h of DEMO_HOMEOWNERS)
      console.log(`    HOMEOWNER     ${h.email}`);
    if (auth[PLATFORM_ADMIN.email])
      console.log(`    PLATFORM     ${PLATFORM_ADMIN.email}  (sign in at /platform/login)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
