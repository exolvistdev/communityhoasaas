import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import {
  AMENITY_BOOKING_STATUS_BADGE,
  bookingHoursLabel,
  fmtSlot,
} from "@/lib/amenity";
import { CancelBookingButton } from "./CancelBookingButton";

export const metadata = { title: "Amenities · HOA SaaS" };

export default async function PortalAmenitiesPage({
  searchParams,
}: {
  searchParams: { past?: string };
}) {
  const { user, org } = await getHomeownerContext();
  const showPast = searchParams.past === "1";
  const now = new Date();

  const [amenities, bookings] = await Promise.all([
    prisma.amenity.findMany({
      where: { orgId: org.id, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.amenityBooking.findMany({
      where: {
        requesterId: user.id,
        ...(showPast
          ? {}
          : { status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gt: now } }),
      },
      include: { amenity: { select: { name: true } } },
      orderBy: { startAt: showPast ? "desc" : "asc" },
      take: showPast ? 30 : undefined,
    }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-fg">Amenities</h1>

      {amenities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-muted">
          Your HOA hasn&apos;t set up any bookable amenities yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {amenities.map((a) => (
            <li key={a.id}>
              <Link
                href={`/portal/amenities/${a.id}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:border-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-fg">{a.name}</span>
                  {Number(a.fee) > 0 && (
                    <span className="text-sm text-fg-muted">
                      {peso(Number(a.fee), { cents: false })}
                    </span>
                  )}
                </div>
                {a.description && (
                  <p className="mt-0.5 text-sm text-fg-muted">{a.description}</p>
                )}
                <p className="mt-1 text-xs text-fg-subtle">
                  {bookingHoursLabel(a)}
                  {a.requiresApproval ? " · needs approval" : " · books instantly"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">
            {showPast ? "Your booking history" : "Your upcoming bookings"}
          </h2>
          <Link
            href={showPast ? "/portal/amenities" : "/portal/amenities?past=1"}
            className="text-xs text-fg-muted underline hover:text-fg"
          >
            {showPast ? "Upcoming" : "History"}
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
            {showPast ? "No past bookings." : "No upcoming bookings."}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {bookings.map((b) => {
              const badge = AMENITY_BOOKING_STATUS_BADGE[b.status];
              const cancellable =
                (b.status === "PENDING" || b.status === "CONFIRMED") &&
                b.startAt > now;
              return (
                <li key={b.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-fg">
                      {b.amenity.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-fg-muted">
                    {fmtSlot(b.startAt, b.endAt)}
                  </div>
                  {b.status === "REJECTED" && b.decisionNote && (
                    <div className="mt-1 rounded bg-danger-subtle px-2 py-1 text-xs text-danger-fg">
                      {b.decisionNote}
                    </div>
                  )}
                  {cancellable && (
                    <div className="mt-1">
                      <CancelBookingButton id={b.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
