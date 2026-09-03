import { prisma } from "@/lib/prisma";
import {
  SEED_ACCOUNTS,
  postInvoiceIssued,
  postPaymentReceived,
} from "@/lib/ledger";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";

/** True when an integration Postgres is configured (CI, or a local scratch DB). */
export const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

/**
 * Drop a test org and every row that hangs off it, in FK order.
 * Mirrors `resetDemoOrg()` in prisma/seed.ts — keep the two in sync when a new
 * table gains an FK to organizations / users / properties / invoices.
 */
export async function resetTestOrg(subdomain: string) {
  const org = await prisma.organization.findUnique({ where: { subdomain } });
  if (!org) return;
  const orgId = org.id;

  await prisma.conversationReport.deleteMany({ where: { conversation: { orgId } } });
  await prisma.marketMessage.deleteMany({ where: { conversation: { orgId } } });
  await prisma.marketConversation.deleteMany({ where: { orgId } });
  await prisma.listingReport.deleteMany({ where: { listing: { orgId } } });
  await prisma.marketplaceListing.deleteMany({ where: { orgId } });
  await prisma.marketplaceBlock.deleteMany({ where: { orgId } });
  await prisma.amenityBooking.deleteMany({ where: { orgId } });
  await prisma.amenity.deleteMany({ where: { orgId } });
  await prisma.document.deleteMany({ where: { orgId } });
  await prisma.journalLine.deleteMany({ where: { entry: { orgId } } });
  await prisma.journalEntry.deleteMany({ where: { orgId } });
  await prisma.payment.deleteMany({ where: { invoice: { property: { orgId } } } });
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
  await prisma.impersonationEvent.deleteMany({ where: { targetUser: { orgId } } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

let seq = 0;

/** A fresh org with the standard chart of accounts. Unique subdomain per call. */
export async function createTestOrg(overrides: Record<string, unknown> = {}) {
  const subdomain = `test-${Date.now().toString(36)}-${seq++}`;
  const org = await prisma.organization.create({
    data: { name: `Test HOA ${subdomain}`, subdomain, ...overrides },
  });
  await prisma.account.createMany({
    data: SEED_ACCOUNTS.map((a) => ({ ...a, orgId: org.id })),
  });
  return org;
}

/** A property in an org, optionally with one unlinked homeowner. */
export async function createTestProperty(
  orgId: string,
  opts: { unitNumber?: string; monthlyRate?: number; homeownerName?: string } = {}
) {
  return prisma.property.create({
    data: {
      orgId,
      unitNumber: opts.unitNumber ?? `Unit ${seq++}`,
      monthlyRate: opts.monthlyRate ?? 1500,
      homeowners: opts.homeownerName
        ? { create: { fullName: opts.homeownerName, isPrimary: true } }
        : undefined,
    },
  });
}

/** Issue a dues/charge invoice and post it to the ledger. */
export async function issueInvoice(
  propertyId: string,
  opts: { amount: number; period?: string | null; dueDate?: Date; status?: "SENT" | "DRAFT" }
) {
  const invoice = await prisma.invoice.create({
    data: {
      propertyId,
      amount: opts.amount,
      period: opts.period ?? null,
      dueDate: opts.dueDate ?? new Date(),
      status: opts.status ?? "SENT",
      memo: opts.period ? `Monthly dues — ${opts.period}` : "Test charge",
    },
  });
  await postInvoiceIssued(invoice.id);
  return invoice;
}

/**
 * Record a payment against an invoice. When CONFIRMED (the default) it creates
 * an allocation and posts to the ledger. Pass `allocations` to split across
 * several invoices; anything not allocated becomes resident credit.
 */
export async function recordPayment(
  invoiceId: string,
  amount: number,
  opts: {
    method?: PaymentMethod;
    status?: PaymentStatus;
    paidAt?: Date;
    allocations?: { invoiceId: string; amount: number }[];
  } = {}
) {
  const status = opts.status ?? "CONFIRMED";
  let allocations = opts.allocations;
  if (!allocations && status === "CONFIRMED") {
    // default: fill this invoice's remaining room, cap the rest as credit
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
    });
    const room =
      Number(invoice.amount) -
      invoice.allocations.reduce((s, a) => s + Number(a.amount), 0) -
      invoice.creditApplications.reduce((s, c) => s + Number(c.amount), 0);
    const take = Math.max(0, Math.min(amount, room));
    allocations = take > 0.005 ? [{ invoiceId, amount: take }] : [];
  }
  allocations = allocations ?? [];

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      method: opts.method ?? "CASH",
      status,
      paidAt: opts.paidAt ?? new Date(),
      allocations: { create: allocations },
    },
  });
  if (status === "CONFIRMED") await postPaymentReceived(payment.id);
  return payment;
}
