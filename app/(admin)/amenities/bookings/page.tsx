import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { AMENITY_BOOKING_STATUS_BADGE, fmtSlot, fmtDateTime } from "@/lib/amenity";
import { displayUnit, unitLinkSelect } from "@/lib/homeowner";
import { BookingDecision, StaffCancelButton } from "../BookingActions";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Booking requests · HOA SaaS" };

const bookingInclude = {
  amenity: { select: { name: true, fee: true } },
  requester: {
    select: { fullName: true, homeowners: { select: unitLinkSelect } },
  },
  decidedBy: { select: { fullName: true } },
} as const;

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
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id} className="border-t border-border first:border-t-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">
                        {b.amenity.name}
                      </div>
                      <div className="text-fg-muted">
                        {fmtSlot(b.startAt, b.endAt)}
                      </div>
                      {b.purpose && (
                        <div className="text-xs text-fg-subtle">{b.purpose}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {b.requester.fullName}
                      <div className="text-xs text-fg-subtle">Unit {unit(b)}</div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {Number(b.amenity.fee) > 0
                        ? peso(Number(b.amenity.fee), { cents: false })
                        : "Free"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BookingDecision id={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {staleRequests.map((b) => (
                  <tr key={b.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2.5 font-medium text-fg">
                      {b.amenity.name}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {fmtSlot(b.startAt, b.endAt)}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {b.requester.fullName} · {unit(b)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <BookingDecision id={b.id} rejectOnly />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">
            Upcoming ({upcoming.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2.5 font-medium text-fg">
                      {b.amenity.name}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {fmtSlot(b.startAt, b.endAt)}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {b.requester.fullName} · {unit(b)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <StaffCancelButton id={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Recently decided</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((b) => {
                  const badge = AMENITY_BOOKING_STATUS_BADGE[b.status];
                  return (
                    <tr key={b.id} className="border-t border-border first:border-t-0">
                      <td className="px-4 py-2 font-medium text-fg">
                        {b.amenity.name}
                      </td>
                      <td className="px-4 py-2 text-fg-muted">
                        {fmtSlot(b.startAt, b.endAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-fg-subtle">
                        {b.decidedAt ? fmtDateTime(b.decidedAt) : ""}
                        {b.decidedBy ? ` · ${b.decidedBy.fullName}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
