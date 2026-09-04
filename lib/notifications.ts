import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/email";

/* ── catalog ────────────────────────────────────────────────────────── */

export type NotificationCategory =
  | "billing"
  | "announcements"
  | "governance"
  | "amenities"
  | "maintenance"
  | "marketplace";

export const CATEGORIES: {
  key: NotificationCategory;
  label: string;
  hint: string;
}[] = [
  { key: "billing", label: "Billing", hint: "Dues, payments, overdue notices" },
  { key: "announcements", label: "Announcements", hint: "New HOA announcements" },
  {
    key: "governance",
    label: "Board & governance",
    hint: "Meetings, votes and elections",
  },
  { key: "amenities", label: "Amenities", hint: "Booking requests and decisions" },
  { key: "maintenance", label: "Maintenance", hint: "Updates on your repair requests" },
  { key: "marketplace", label: "Marketplace", hint: "Messages and moderation" },
];

type CatalogEntry = {
  category: NotificationCategory;
  defaultEmail: boolean;
  defaultInApp: boolean;
};

export const NOTIFICATION_CATALOG: Record<NotificationType, CatalogEntry> = {
  DUES_ISSUED: { category: "billing", defaultEmail: true, defaultInApp: true },
  PAYMENT_CONFIRMED: { category: "billing", defaultEmail: true, defaultInApp: true },
  PAYMENT_REJECTED: { category: "billing", defaultEmail: true, defaultInApp: true },
  PAYMENT_SUBMITTED: { category: "billing", defaultEmail: false, defaultInApp: true },
  INVOICE_OVERDUE: { category: "billing", defaultEmail: true, defaultInApp: true },
  LATE_FEE_APPLIED: { category: "billing", defaultEmail: true, defaultInApp: true },
  PAYMENT_REFUNDED: { category: "billing", defaultEmail: true, defaultInApp: true },
  VIOLATION_NOTICE: { category: "billing", defaultEmail: true, defaultInApp: true },
  ANNOUNCEMENT: { category: "announcements", defaultEmail: true, defaultInApp: true },
  AMENITY_BOOKING_REQUESTED: { category: "amenities", defaultEmail: true, defaultInApp: true },
  AMENITY_BOOKING_DECIDED: { category: "amenities", defaultEmail: true, defaultInApp: true },
  AMENITY_BOOKING_CANCELLED: { category: "amenities", defaultEmail: true, defaultInApp: true },
  MARKETPLACE_MESSAGE: { category: "marketplace", defaultEmail: true, defaultInApp: false },
  MARKETPLACE_LISTING_REPORTED: { category: "marketplace", defaultEmail: true, defaultInApp: true },
  MARKETPLACE_LISTING_MODERATED: { category: "marketplace", defaultEmail: true, defaultInApp: true },
  MARKETPLACE_CONVERSATION_REPORTED: { category: "marketplace", defaultEmail: true, defaultInApp: true },
  MAINTENANCE_UPDATE: { category: "maintenance", defaultEmail: true, defaultInApp: true },
  BOARD_MEETING: { category: "governance", defaultEmail: true, defaultInApp: true },
  BOARD_VOTE: { category: "governance", defaultEmail: true, defaultInApp: true },
  BOARD_ELECTION: { category: "governance", defaultEmail: true, defaultInApp: true },
};

export type ChannelPrefs = { email: boolean; inApp: boolean };
export type NotificationPrefs = Record<NotificationCategory, ChannelPrefs>;

export function defaultPrefs(): NotificationPrefs {
  return {
    billing: { email: true, inApp: true },
    announcements: { email: true, inApp: true },
    governance: { email: true, inApp: true },
    amenities: { email: true, inApp: true },
    maintenance: { email: true, inApp: true },
    marketplace: { email: true, inApp: true },
  };
}

/* ── recipients ─────────────────────────────────────────────────────── */

export const recipientSelect = {
  id: true,
  email: true,
  emailNotifications: true,
  deactivatedAt: true,
  notificationPrefs: true,
} satisfies Prisma.UserSelect;

export type Recipient = Prisma.UserGetPayload<{ select: typeof recipientSelect }>;

/** Resolve a recipient's effective channels for a notification type. */
export function prefFor(user: Recipient, type: NotificationType): ChannelPrefs {
  if (user.deactivatedAt) return { email: false, inApp: false };
  const entry = NOTIFICATION_CATALOG[type];
  const stored = (user.notificationPrefs ?? null) as Partial<NotificationPrefs> | null;
  const cat = stored?.[entry.category];
  return {
    email:
      user.emailNotifications &&
      (cat?.email ?? entry.defaultEmail),
    inApp: cat?.inApp ?? entry.defaultInApp,
  };
}

/** Org staff of the given roles, with recipient fields. */
export async function staffRecipients(
  orgId: string,
  roles: ("ADMIN" | "TREASURER" | "BOARD_MEMBER")[]
): Promise<Recipient[]> {
  return prisma.user.findMany({
    where: { orgId, role: { in: roles }, deactivatedAt: null },
    select: recipientSelect,
  });
}

/* ── delivery ───────────────────────────────────────────────────────── */

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

/**
 * Fan out one event to a set of recipients across the enabled channels,
 * gated per-user by `prefFor`. The in-app row uses `title`/`body`/`href`;
 * the email uses `email` when given, else a generic shell built from `title`/`body`.
 * Best-effort — never throws (a delivery hiccup must not break the action).
 */
export async function deliver(opts: {
  users: Recipient[];
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  email?: {
    subject?: string;
    bodyHtml: string;
    ctaHref?: string;
    ctaLabel?: string;
  };
}) {
  try {
    const inApp: {
      userId: string;
      type: NotificationType;
      title: string;
      body: string | null;
      href: string | null;
    }[] = [];
    const emails: Recipient[] = [];

    for (const u of opts.users) {
      const p = prefFor(u, opts.type);
      if (p.inApp)
        inApp.push({
          userId: u.id,
          type: opts.type,
          title: opts.title,
          body: opts.body ?? null,
          href: opts.href ?? null,
        });
      if (p.email) emails.push(u);
    }

    if (inApp.length) await prisma.notification.createMany({ data: inApp });

    if (emails.length) {
      const html = emailShell({
        heading: opts.title,
        bodyHtml: opts.email?.bodyHtml ?? (opts.body ? `<p>${esc(opts.body)}</p>` : ""),
        ctaHref: opts.email?.ctaHref ?? opts.href ?? "/notifications",
        ctaLabel: opts.email?.ctaLabel ?? "Open in HOA Manager",
      });
      const subject = opts.email?.subject ?? opts.title;
      await Promise.all(
        emails.map((u) => sendEmail({ to: u.email, subject, html }))
      );
    }
  } catch (e) {
    console.error("[notify]", (e as Error).message);
  }
}

/* ── reads ──────────────────────────────────────────────────────────── */

export async function getNotificationSummary(userId: string) {
  const [unread, recent] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { unread, recent };
}

/* ── overdue sweep (cron / script) ─────────────────────────────────── */

/** Notify homeowners of overdue invoices. Deduped: at most one per user / 25 days. */
export async function generateOverdueNotifications(orgId?: string) {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ["PAID", "VOID"] },
      property: {
        ...(orgId ? { orgId } : {}),
        archivedAt: null, // a moved-out unit shouldn't keep nagging
        homeowners: { some: { userId: { not: null } } },
      },
    },
    include: {
      property: {
        select: {
          unitNumber: true,
          homeowners: {
            where: { userId: { not: null } },
            select: { user: { select: recipientSelect } },
          },
        },
      },
      allocations: {
        where: { payment: { status: "CONFIRMED" } },
        select: { amount: true },
      },
      creditApplications: { select: { amount: true } },
    },
  });

  const cutoff = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
  let sent = 0;

  for (const inv of invoices) {
    const paid =
      inv.allocations.reduce((s, a) => s + Number(a.amount), 0) +
      inv.creditApplications.reduce((s, c) => s + Number(c.amount), 0);
    const remaining = Number(inv.amount) - paid;
    if (remaining <= 0.005) continue;

    const title = `Overdue balance — ${inv.property.unitNumber}`;

    for (const h of inv.property.homeowners) {
      if (!h.user) continue;
      // Dedupe per unit (title carries the unit) — a multi-unit owner still
      // gets one notice per overdue unit rather than one total.
      const recentlyPinged = await prisma.notification.count({
        where: {
          userId: h.user.id,
          type: "INVOICE_OVERDUE",
          title,
          createdAt: { gt: cutoff },
        },
      });
      if (recentlyPinged > 0) continue;

      await deliver({
        users: [h.user],
        type: "INVOICE_OVERDUE",
        title,
        body: `₱${remaining.toLocaleString("en-PH")} is past due (was due ${inv.dueDate.toLocaleDateString(
          "en-PH",
          { day: "numeric", month: "long", year: "numeric" }
        )}).`,
        href: "/portal",
      });
      sent++;
    }
  }
  return { sent };
}
