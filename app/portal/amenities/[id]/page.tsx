import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import {
  APP_TZ,
  bookingHoursLabel,
  labelHour,
  zonedDateInput,
  zonedInstant,
} from "@/lib/amenity";
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

  const now = Date.now();
  const minStartMs = now + amenity.minNoticeHours * 3_600_000;

  const dateStr =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : zonedDateInput(new Date(minStartMs));

  const [y, m, d] = dateStr.split("-").map(Number);
  const dayStart = zonedInstant(y, m, d, 0);
  const dayEnd = zonedInstant(y, m, d + 1, 0);

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
  const cellState = (h: number) => {
    const cellStart = zonedInstant(y, m, d, h).getTime();
    const cellEnd = cellStart + 3_600_000;
    const taken = dayBookings.filter(
      (b) => b.startAt.getTime() < cellEnd && b.endAt.getTime() > cellStart
    ).length;
    if (taken >= amenity.capacity) return "full" as const;
    if (cellStart < minStartMs) return "past" as const;
    return "open" as const;
  };
  const takenHours = hours.filter((h) => cellState(h) === "full");

  const shiftDate = (delta: number) =>
    `/portal/amenities/${amenity.id}?date=${zonedDateInput(zonedInstant(y, m, d + delta, 12))}`;

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
        <div>
          Free cancellation up to {amenity.cancellationCutoffHours}h before
          {Number(amenity.fee) > 0
            ? " — after that, contact the office"
            : ""}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <Link href={shiftDate(-1)} className="text-gray-500 hover:text-gray-900">
            ‹ Prev
          </Link>
          <span className="font-medium text-gray-900">
            {zonedInstant(y, m, d, 12).toLocaleDateString("en-PH", {
              timeZone: APP_TZ,
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
            const state = cellState(h);
            return (
              <div
                key={h}
                className={`rounded-md px-1 py-2 text-center text-xs ${
                  state === "full"
                    ? "bg-gray-200 text-gray-400 line-through"
                    : state === "past"
                    ? "bg-gray-100 text-gray-300"
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
        takenHours={takenHours}
        minStartMs={minStartMs}
      />
    </div>
  );
}
