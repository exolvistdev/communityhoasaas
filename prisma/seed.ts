import { PrismaClient } from "@prisma/client";
import {
  SEED_ACCOUNTS,
  postInvoiceIssued,
  postPaymentReceived,
  postManualEntry,
  postWriteOff,
} from "../lib/ledger";
import { currentPeriod } from "../lib/format";
import { generateGatePassCode } from "../lib/gatepass";
import { zonedInstant, zonedParts } from "../lib/amenity";
import { generateOverdueNotifications } from "../lib/notifications";
import { applyLateFees } from "../lib/late-fees";
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
  await prisma.document.deleteMany({ where: { orgId } });
  await prisma.conversationReport.deleteMany({
    where: { conversation: { orgId } },
  });
  await prisma.marketMessage.deleteMany({
    where: { conversation: { orgId } },
  });
  await prisma.marketConversation.deleteMany({ where: { orgId } });
  await prisma.listingReport.deleteMany({ where: { listing: { orgId } } });
  await prisma.marketplaceListing.deleteMany({ where: { orgId } });
  await prisma.marketplaceBlock.deleteMany({ where: { orgId } });
  await prisma.amenityBooking.deleteMany({ where: { orgId } });
  await prisma.amenity.deleteMany({ where: { orgId } });
  await prisma.journalLine.deleteMany({ where: { entry: { orgId } } });
  await prisma.journalEntry.deleteMany({ where: { orgId } });
  await prisma.creditApplication.deleteMany({ where: { orgId } });
  await prisma.paymentAllocation.deleteMany({
    where: { payment: { invoice: { property: { orgId } } } },
  });
  await prisma.payment.deleteMany({
    where: { invoice: { property: { orgId } } },
  });
  await prisma.invoice.deleteMany({ where: { property: { orgId } } });
  await prisma.gatePassScan.deleteMany({ where: { orgId } });
  await prisma.gatePass.deleteMany({ where: { property: { orgId } } });
  await prisma.ownershipTransfer.deleteMany({ where: { orgId } });
  await prisma.auditEvent.deleteMany({ where: { orgId } });
  await prisma.announcement.deleteMany({ where: { orgId } });
  await prisma.homeowner.deleteMany({ where: { property: { orgId } } });
  await prisma.property.deleteMany({ where: { orgId } });
  await prisma.ratePlan.deleteMany({ where: { orgId } });
  await prisma.account.deleteMany({ where: { orgId } });
  await prisma.notification.deleteMany({ where: { user: { orgId } } });
  await prisma.dataRequest.deleteMany({ where: { orgId } });
  await prisma.impersonationEvent.deleteMany({
    where: { targetUser: { orgId } },
  });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

async function main() {
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
