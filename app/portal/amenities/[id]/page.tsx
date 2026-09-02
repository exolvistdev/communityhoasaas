import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import { bookingHoursLabel, labelHour, toDateInput } from "@/lib/amenity";
import { BookAmenityForm } from "./BookAmenityForm";

export const metadata = { title: "Amenity · HOA SaaS" };

export default async function AmenityDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const { org } = await getHomeownerContext();

  const amenity = await prisma.amenity.findFirst({
    where: { id: params.id, orgId: org.id, archivedAt: null },
  });
  if (!amenity) notFound();

  // Default the availability view to the earliest bookable day.
  const earliest = new Date(
    Date.now() + amenity.minNoticeHours * 3_600_000
  );
  const dateStr =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : toDateInput(earliest);

  const [y, m, d] = dateStr.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  const dayBookings = await prisma.amenityBooking.findMany({
    where: {
      amenityId: amenity.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });

  const hours = Array.from(
    { length: Math.max(0, amenity.closeHour - amenity.openHour) },
    (_, i) => amenity.openHour + i
  );
  const takenCount = (h: number) => {
    const cellStart = new Date(y, m - 1, d, h).getTime();
    const cellEnd = cellStart + 3_600_000;
    return dayBookings.filter(
      (b) => b.startAt.getTime() < cellEnd && b.endAt.getTime() > cellStart
    ).length;
  };

  const shiftDate = (delta: number) => {
    const nd = new Date(y, m - 1, d + delta);
    return `/portal/amenities/${amenity.id}?date=${toDateInput(nd)}`;
  };

  return (
    <div className="space-y-4">
      <Link
        href="/portal/amenities"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Amenities
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">{amenity.name}</h1>
        {amenity.description && (
          <p className="mt-1 text-sm text-gray-600">{amenity.description}</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
        <div>Hours: {bookingHoursLabel(amenity)}</div>
        <div>
          {Number(amenity.fee) > 0
            ? `Fee: ${peso(Number(amenity.fee), { cents: false })}`
            : "Free to book"}
          {amenity.feeNote ? ` — ${amenity.feeNote}` : ""}
        </div>
        <div>
          Book {amenity.minNoticeHours}h ahead · up to {amenity.maxHours}h ·{" "}
          {amenity.requiresApproval
            ? "staff approval required"
            : "confirmed instantly"}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <Link href={shiftDate(-1)} className="text-gray-500 hover:text-gray-900">
            ‹ Prev
          </Link>
          <span className="font-medium text-gray-900">
            {dayStart.toLocaleDateString("en-PH", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <Link href={shiftDate(1)} className="text-gray-500 hover:text-gray-900">
            Next ›
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {hours.map((h) => {
            const full = takenCount(h) >= amenity.capacity;
            return (
              <div
                key={h}
                className={`rounded-md px-1 py-2 text-center text-xs ${
                  full
                    ? "bg-gray-200 text-gray-400 line-through"
                    : "bg-green-50 text-green-800"
                }`}
              >
                {labelHour(h)}
              </div>
            );
          })}
        </div>
      </div>

      <BookAmenityForm
        amenityId={amenity.id}
        amenity={{
          openHour: amenity.openHour,
          closeHour: amenity.closeHour,
          minNoticeHours: amenity.minNoticeHours,
          maxHours: amenity.maxHours,
        }}
        defaultDate={dateStr}
      />
    </div>
  );
}
