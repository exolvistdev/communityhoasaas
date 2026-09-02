import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { AmenitiesManager, type AmenityRow } from "./AmenitiesManager";

export const metadata = { title: "Amenities · HOA SaaS" };

export default async function AmenitiesPage() {
  const { org } = await requirePermission("amenity:manage");

  const [amenities, pendingCount] = await Promise.all([
    prisma.amenity.findMany({
      where: { orgId: org.id },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ["PENDING", "CONFIRMED"] },
                startAt: { gt: new Date() },
              },
            },
          },
        },
      },
    }),
    prisma.amenityBooking.count({
      where: { orgId: org.id, status: "PENDING", startAt: { gt: new Date() } },
    }),
  ]);

  const rows: AmenityRow[] = amenities.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    fee: Number(a.fee),
    feeNote: a.feeNote,
    capacity: a.capacity,
    openHour: a.openHour,
    closeHour: a.closeHour,
    minNoticeHours: a.minNoticeHours,
    maxHours: a.maxHours,
    cancellationCutoffHours: a.cancellationCutoffHours,
    requiresApproval: a.requiresApproval,
    archived: a.archivedAt !== null,
    upcomingCount: a._count.bookings,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">Amenities</h1>
        <Link
          href="/amenities/bookings"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2"
        >
          Booking requests
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-warning-subtle px-1.5 text-xs font-medium text-warning-fg">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-muted">
          No amenities yet. Add the clubhouse, courts, function hall…
        </p>
      )}

      <AmenitiesManager amenities={rows} />
    </div>
  );
}
