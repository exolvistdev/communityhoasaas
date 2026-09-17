import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { AMENITY_BOOKING_STATUS_BADGE, fmtSlot, fmtDateTime } from "@/lib/amenity";
import { displayUnit, unitLinkSelect } from "@/lib/homeowner";
import { BookingDecision, StaffCancelButton } from "../BookingActions";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export const metadata = { title: "Booking requests · HOA SaaS" };

const bookingInclude = {
  amenity: { select: { name: true, fee: true } },
  requester: {
    select: { fullName: true, homeowners: { select: unitLinkSelect } },
  },
  decidedBy: { select: { fullName: true } },
} as const;

type Booking = Awaited<
  ReturnType<typeof prisma.amenityBooking.findMany<{ include: typeof bookingInclude }>>
>[number];

function unit(b: {
  requester: { homeowners: { isPrimary: boolean; property: { unitNumber: string } | null }[] };
}) {
  return displayUnit(b.requester.homeowners) ?? "—";
}

export default async function AmenityBookingsPage() {
  const { org } = await requirePermission("amenity:manage");
  const now = new Date();

  const [pending, staleRequests, upcoming, recent] = await Promise.all([
    prisma.amenityBooking.findMany({
      where: { orgId: org.id, status: "PENDING", startAt: { gt: now } },
      include: bookingInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.amenityBooking.findMany({
      where: { orgId: org.id, status: "PENDING", startAt: { lte: now } },
      include: bookingInclude,
      orderBy: { startAt: "desc" },
    }),
    prisma.amenityBooking.findMany({
      where: { orgId: org.id, status: "CONFIRMED", startAt: { gt: now } },
      include: bookingInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.amenityBooking.findMany({
      where: {
        orgId: org.id,
        status: { in: ["REJECTED", "CANCELLED", "CONFIRMED"] },
        decidedAt: { not: null },
      },
      include: bookingInclude,
      orderBy: { decidedAt: "desc" },
      take: 12,
    }),
  ]);

  const pendingColumns: ResponsiveColumn<Booking>[] = [
    {
      key: "amenity",
      header: "Amenity",
      card: "title",
      cell: (b) => (
        <>
          <div className="font-medium text-fg">{b.amenity.name}</div>
          <div className="text-fg-muted">{fmtSlot(b.startAt, b.endAt)}</div>
          {b.purpose && (
            <div className="text-xs text-fg-subtle">{b.purpose}</div>
          )}
        </>
      ),
    },
    {
      key: "requester",
      header: "Requester",
      className: "text-fg-muted",
      cell: (b) => (
        <>
          {b.requester.fullName}
          <div className="text-xs text-fg-subtle">Unit {unit(b)}</div>
        </>
      ),
    },
    {
      key: "fee",
      header: "Fee",
      className: "text-fg-muted",
      cell: (b) =>
        Number(b.amenity.fee) > 0
          ? peso(Number(b.amenity.fee), { cents: false })
          : "Free",
    },
    {
      key: "action",
      header: "Actions",
      align: "right",
      card: "action",
      cell: (b) => <BookingDecision id={b.id} />,
    },
  ];

  const staleColumns: ResponsiveColumn<Booking>[] = [
    {
      key: "amenity",
      header: "Amenity",
      card: "title",
      className: "font-medium",
      cell: (b) => b.amenity.name,
    },
    {
      key: "slot",
      header: "Requested for",
      className: "text-fg-muted",
      cell: (b) => fmtSlot(b.startAt, b.endAt),
    },
    {
      key: "requester",
      header: "Requester",
      className: "text-fg-muted",
      cell: (b) => `${b.requester.fullName} · ${unit(b)}`,
    },
    {
      key: "action",
      header: "Actions",
      align: "right",
      card: "action",
      cell: (b) => <BookingDecision id={b.id} rejectOnly />,
    },
  ];

  const upcomingColumns: ResponsiveColumn<Booking>[] = [
    {
      key: "amenity",
      header: "Amenity",
      card: "title",
      className: "font-medium",
      cell: (b) => b.amenity.name,
    },
    {
      key: "slot",
      header: "When",
      className: "text-fg-muted",
      cell: (b) => fmtSlot(b.startAt, b.endAt),
    },
    {
      key: "requester",
      header: "Requester",
      className: "text-fg-muted",
      cell: (b) => `${b.requester.fullName} · ${unit(b)}`,
    },
    {
      key: "action",
      header: "Actions",
      align: "right",
      card: "action",
      cell: (b) => <StaffCancelButton id={b.id} />,
    },
  ];

  const recentColumns: ResponsiveColumn<Booking>[] = [
    {
      key: "amenity",
      header: "Amenity",
      card: "title",
      className: "font-medium",
      cell: (b) => b.amenity.name,
    },
    {
      key: "slot",
      header: "When",
      className: "text-fg-muted",
      cell: (b) => fmtSlot(b.startAt, b.endAt),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (b) => {
        const badge = AMENITY_BOOKING_STATUS_BADGE[b.status];
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "decided",
      header: "Decided",
      align: "right",
      className: "text-xs text-fg-subtle",
      cell: (b) => (
        <>
          {b.decidedAt ? fmtDateTime(b.decidedAt) : ""}
          {b.decidedBy ? ` · ${b.decidedBy.fullName}` : ""}
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking requests"
        backLink={{ href: "/amenities", label: "Amenities" }}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">
          Awaiting approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Nothing to review. 🎉
          </div>
        ) : (
          <ResponsiveTable
            columns={pendingColumns}
            rows={pending}
            rowKey={(b) => b.id}
            rowClassName={() => "align-top"}
            hideHeader
          />
        )}
      </section>

      {staleRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">
            Requested but never actioned ({staleRequests.length})
          </h2>
          <p className="text-xs text-fg-subtle">
            The requested date has passed. Reject to clear them.
          </p>
          <ResponsiveTable
            columns={staleColumns}
            rows={staleRequests}
            rowKey={(b) => b.id}
            hideHeader
          />
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">
            Upcoming ({upcoming.length})
          </h2>
          <ResponsiveTable
            columns={upcomingColumns}
            rows={upcoming}
            rowKey={(b) => b.id}
            hideHeader
          />
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Recently decided</h2>
          <ResponsiveTable
            columns={recentColumns}
            rows={recent}
            rowKey={(b) => b.id}
            hideHeader
          />
        </section>
      )}
    </div>
  );
}
