import type { AmenityBookingStatus } from "@prisma/client";

// Pure helpers — safe to import from client components.

export const MAX_UPCOMING_PER_USER = 3;

export const AMENITY_BOOKING_STATUS_BADGE: Record<
  AmenityBookingStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Confirmed", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-200 text-gray-700" },
};

type Rules = {
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
};

/** Human-readable reasons a start/end pair breaks an amenity's booking rules. */
export function bookingRuleViolations(
  a: Rules,
  startAt: Date,
  endAt: Date,
  now: Date = new Date()
): string[] {
  const out: string[] = [];
  const HOUR = 3_600_000;

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return ["Pick a valid date and time."];
  }
  if (endAt <= startAt) out.push("The end time must be after the start time.");
  if (startAt <= now) out.push("Pick a time in the future.");
  if (startAt.getTime() - now.getTime() < a.minNoticeHours * HOUR)
    out.push(`Book at least ${a.minNoticeHours} hours ahead.`);
  if (endAt.getTime() - startAt.getTime() > a.maxHours * HOUR + 1)
    out.push(`Bookings can be at most ${a.maxHours} hours.`);
  if (
    startAt.getFullYear() !== endAt.getFullYear() ||
    startAt.getMonth() !== endAt.getMonth() ||
    startAt.getDate() !== endAt.getDate()
  )
    out.push("A booking must start and end on the same day.");

  const endMinutes = endAt.getHours() * 60 + endAt.getMinutes();
  if (startAt.getHours() < a.openHour || endMinutes > a.closeHour * 60)
    out.push(
      `${labelHour(a.openHour)}–${labelHour(a.closeHour)} only.`
    );

  return out;
}

export function labelHour(h: number) {
  const period = h < 12 || h === 24 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${period}`;
}

export function bookingHoursLabel(a: { openHour: number; closeHour: number }) {
  return `${labelHour(a.openHour)}–${labelHour(a.closeHour)}`;
}

const DT = {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
} as const;

export function fmtSlot(start: Date, end: Date) {
  const d = start.toLocaleDateString("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = (x: Date) =>
    x.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  return `${d}, ${t(start)}–${t(end)}`;
}

export function fmtDateTime(d: Date) {
  return d.toLocaleString("en-PH", DT);
}

/** YYYY-MM-DD in local time. */
export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
