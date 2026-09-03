import Link from "next/link";
import {
  ShieldCheck,
  Megaphone,
  Store,
  MessageSquare,
  CalendarDays,
  CalendarClock,
  Vote,
  Droplet,
  FileText,
  Gavel,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { invoicePaid } from "@/lib/invoice";
import { peso, periodLabel } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { waterMetered } from "@/lib/water";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });
const shortDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalHome() {
  const { user, property, org } = await getHomeownerContext();

  if (!property) {
    return (
      <EmptyState
        title={`Hi ${user.fullName.split(" ")[0]}`}
        description="Your account isn't linked to a unit yet. Please contact your HOA office so they can connect it."
      />
    );
  }

  const now = new Date();
  const [
    statement,
    invoices,
    payments,
    announcementCount,
    listingCount,
    unreadMessages,
    amenityCount,
    upcomingBookings,
    documentCount,
    violationCount,
    upcomingMeetings,
    openVotes,
    waterMeter,
  ] = await Promise.all([
    buildStatement(property.id, parseStatementRange({})),
    prisma.invoice.findMany({
      where: { propertyId: property.id, status: { notIn: ["PAID", "VOID"] } },
      include: {
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { invoice: { propertyId: property.id } },
      include: { invoice: { select: { period: true } } },
      orderBy: { paidAt: "desc" },
      take: 15,
    }),
    prisma.announcement.count({
      where: { orgId: property.orgId, publishedAt: { not: null } },
    }),
    prisma.marketplaceListing.count({
      where: { orgId: property.orgId, status: "ACTIVE" },
    }),
    prisma.marketMessage.count({
      where: {
        senderId: { not: user.id },
        readAt: null,
        conversation: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      },
    }),
    prisma.amenity.count({
      where: { orgId: property.orgId, archivedAt: null },
    }),
    prisma.amenityBooking.count({
      where: {
        requesterId: user.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gt: now },
      },
    }),
    prisma.document.count({
      where: { orgId: property.orgId, staffOnly: false },
    }),
    prisma.violation.count({ where: { propertyId: property.id } }),
    prisma.boardMeeting.count({
      where: {
        orgId: property.orgId,
        status: "SCHEDULED",
        scheduledAt: { gte: now },
      },
    }),
    prisma.boardVote.count({
      where: {
        orgId: property.orgId,
        status: "OPEN",
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
    }),
    prisma.waterMeter.findFirst({
      where: { propertyId: property.id, retiredAt: null, kind: "UNIT" },
      select: {
        readings: {
          orderBy: { period: "desc" },
          take: 1,
          select: { period: true, consumption: true, amount: true },
        },
      },
    }),
  ]);

  const balance = statement?.closingBalance ?? 0;
  const credit = statement?.creditBalance ?? 0;
  const owes = balance > 0.005;
  const nextDue = invoices[0]?.dueDate ?? null;
  const overdue = invoices.some((i) => i.dueDate.getTime() < now.getTime());
  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  const cardTone = !owes
    ? "border-success/30 bg-success-subtle"
    : overdue
    ? "border-danger/30 bg-danger-subtle"
    : "border-warning/30 bg-warning-subtle";
  const amountTone = !owes
    ? "text-success-fg"
    : overdue
    ? "text-danger-fg"
    : "text-warning-fg";

  return (
    <div className="space-y-4">
      {/* balance card */}
      <div className={`rounded-xl border p-5 shadow-sm ${cardTone}`}>
        <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          {owes ? "Amount due" : "Balance"}
        </div>
        <div className={`mt-1 text-4xl font-semibold tabnums ${amountTone}`}>
          {peso(balance)}
        </div>
        {owes ? (
          <div className="mt-1 text-sm text-fg-muted">
            {overdue ? "Overdue — " : ""}
            {nextDue ? `due ${fmtDate(nextDue)}` : ""}
          </div>
        ) : (
          <div className="mt-1 text-sm font-medium text-success-fg">
            You&apos;re all paid up
          </div>
        )}

        {credit > 0.005 && (
          <div className="mt-1 text-sm text-fg-muted">
            {peso(credit)} credit on file — applied to your next dues automatically.
          </div>
        )}

        {owes && invoices.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            {invoices.map((inv) => {
              const remaining = Number(inv.amount) - invoicePaid(inv);
              const late = inv.dueDate.getTime() < now.getTime();
              return (
                <li key={inv.id} className="flex justify-between text-fg">
                  <span>
                    {inv.period ? periodLabel(inv.period) : "Dues"}
                    {late && (
                      <span className="ml-1 text-xs font-medium text-danger-fg">
                        overdue
                      </span>
                    )}
                  </span>
                  <span>{peso(remaining)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {pendingCount > 0 && (
          <div className="mt-3 rounded-md bg-surface/70 px-3 py-2 text-xs text-fg-muted">
            {pendingCount} payment{pendingCount === 1 ? "" : "s"} submitted and
            awaiting confirmation.
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {owes && (
            <Link href="/portal/pay" className={buttonClass({ className: "flex-1" })}>
              Pay now
            </Link>
          )}
          <Link
            href={`/statements/${property.id}`}
            className={buttonClass({
              variant: "secondary",
              className: owes ? "" : "flex-1",
            })}
          >
            View statement
          </Link>
        </div>
      </div>

      {/* action tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          href="/portal/gate-pass"
          icon={ShieldCheck}
          label="Gate pass"
          sub="Register a visitor"
        />
        <Tile
          href="/portal/announcements"
          icon={Megaphone}
          label="Announcements"
          sub={`${announcementCount} posted`}
        />
        <Tile
          href="/portal/market"
          icon={Store}
          label="Marketplace"
          sub={`${listingCount} listing${listingCount === 1 ? "" : "s"}`}
        />
        <Tile
          href="/portal/messages"
          icon={MessageSquare}
          label="Messages"
          sub={
            unreadMessages > 0
              ? `${unreadMessages} unread`
              : "Buyer & seller chats"
          }
        />
        {amenityCount > 0 && (
          <Tile
            href="/portal/amenities"
            icon={CalendarDays}
            label="Amenities"
            sub={
              upcomingBookings > 0
                ? `${upcomingBookings} upcoming`
                : "Book the clubhouse & courts"
            }
          />
        )}
        {documentCount > 0 && (
          <Tile
            href="/portal/documents"
            icon={FileText}
            label="Documents"
            sub={`${documentCount} file${documentCount === 1 ? "" : "s"}`}
          />
        )}
        {violationCount > 0 && (
          <Tile
            href="/portal/violations"
            icon={Gavel}
            label="Violations"
            sub={`${violationCount} on record`}
          />
        )}
        {upcomingMeetings > 0 && (
          <Tile
            href="/portal/meetings"
            icon={CalendarClock}
            label="Board meetings"
            sub={`${upcomingMeetings} upcoming`}
          />
        )}
        {openVotes > 0 && (
          <Tile
            href="/portal/votes"
            icon={Vote}
            label="Votes"
            sub={`${openVotes} open`}
          />
        )}
        {waterMetered(org.waterSource) && waterMeter?.readings[0] && (
          <Tile
            href="/portal/water"
            icon={Droplet}
            label="Water"
            sub={`${Number(waterMeter.readings[0].consumption).toFixed(1)} m³ · ${peso(
              Number(waterMeter.readings[0].amount)
            )}`}
          />
        )}
      </div>

      {/* payment history */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-fg">
          Payment history
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {payments.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-fg">
                      {p.invoice.period
                        ? periodLabel(p.invoice.period)
                        : "Payment"}
                    </div>
                    <div className="text-xs text-fg-subtle">
                      {METHOD_LABEL[p.method]} · {shortDate(p.paidAt)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-fg">
                      {peso(Number(p.amount))}
                    </div>
                    <PaymentBadge status={p.status} />
                  </div>
                </div>
                {p.status === "REJECTED" && p.note && (
                  <div className="mt-1 rounded bg-danger-subtle px-2 py-1 text-xs text-danger-fg">
                    {p.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "CONFIRMED")
    return (
      <span className="text-xs font-medium text-success-fg">Paid</span>
    );
  if (status === "PENDING")
    return (
      <span className="text-xs font-medium text-warning-fg">
        Awaiting confirmation
      </span>
    );
  return <span className="text-xs font-medium text-danger-fg">Rejected</span>;
}

function Tile({
  href,
  label,
  sub,
  icon: Icon,
}: {
  href: string;
  label: string;
  sub: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-brand-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mt-2.5 text-sm font-medium text-fg">{label}</div>
      <div className="mt-0.5 text-xs text-fg-subtle">{sub}</div>
    </Link>
  );
}
