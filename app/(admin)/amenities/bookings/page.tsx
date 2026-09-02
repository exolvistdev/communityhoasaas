import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import { AMENITY_BOOKING_STATUS_BADGE, fmtSlot, fmtDateTime } from "@/lib/amenity";
import { BookingDecision, StaffCancelButton } from "../BookingActions";

export const metadata = { title: "Booking requests · HOA SaaS" };

const bookingInclude = {
  amenity: { select: { name: true, fee: true } },
  requester: {
    select: {
      fullName: true,
      homeowner: { select: { property: { select: { unitNumber: true } } } },
    },
  },
  decidedBy: { select: { fullName: true } },
} as const;

function unit(b: { requester: { homeowner: { property: { unitNumber: string } | null } | null } }) {
  return b.requester.homeowner?.property?.unitNumber ?? "—";
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
      <div>
        <Link
          href="/amenities"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Amenities
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">
          Booking requests
        </h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">
          Awaiting approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Nothing to review. 🎉
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100 first:border-t-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {b.amenity.name}
                      </div>
                      <div className="text-gray-600">
                        {fmtSlot(b.startAt, b.endAt)}
                      </div>
                      {b.purpose && (
                        <div className="text-xs text-gray-400">{b.purpose}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.requester.fullName}
                      <div className="text-xs text-gray-400">Unit {unit(b)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
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
          <h2 className="text-sm font-semibold text-gray-900">
            Requested but never actioned ({staleRequests.length})
          </h2>
          <p className="text-xs text-gray-400">
            The requested date has passed. Reject to clear them.
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {staleRequests.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {b.amenity.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {fmtSlot(b.startAt, b.endAt)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
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
          <h2 className="text-sm font-semibold text-gray-900">
            Upcoming ({upcoming.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {b.amenity.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {fmtSlot(b.startAt, b.endAt)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
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
          <h2 className="text-sm font-semibold text-gray-900">Recently decided</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((b) => {
                  const badge = AMENITY_BOOKING_STATUS_BADGE[b.status];
                  return (
                    <tr key={b.id} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {b.amenity.name}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {fmtSlot(b.startAt, b.endAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400">
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
