import type { AmenityBookingStatus } from "@prisma/client";

// Pure helpers — safe to import from client components.

export const MAX_UPCOMING_PER_USER = 3;

/**
 * The HOA's wall-clock timezone. This product is Philippine-only, so a fixed
 * zone is honest and correct. All amenity hour-of-day logic (opening hours, the
 * availability grid, min-notice) runs in this zone regardless of where the
 * server or the resident's browser is. Manila has no DST, so the offset is
 * constant — the guess-and-correct in `zonedInstant` is exact.
 */
export const APP_TZ = "Asia/Manila";

const zonedFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Wall-clock fields of an instant, in the HOA timezone. */
export function zonedParts(instant: Date) {
  const p: Record<string, string> = {};
  for (const part of zonedFmt.formatToParts(instant)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: p.hour === "24" ? 0 : Number(p.hour),
    minute: Number(p.minute),
  };
}

/** The instant at a given wall-clock time in the HOA timezone. */
export function zonedInstant(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute = 0
) {
  const guess = Date.UTC(year, month1 - 1, day, hour, minute);
  const p = zonedParts(new Date(guess));
  const seenAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offset = seenAsUTC - guess; // how far APP_TZ leads UTC
  return new Date(guess - offset);
}

/** YYYY-MM-DD for an instant, in the HOA timezone. */
export function zonedDateInput(instant: Date) {
  const p = zonedParts(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export const AMENITY_BOOKING_STATUS_BADGE: Record<
  AmenityBookingStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning/25" },
  CONFIRMED: { label: "Confirmed", className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25" },
  REJECTED: { label: "Rejected", className: "bg-danger-subtle text-danger-fg ring-1 ring-inset ring-danger/25" },
  CANCELLED: { label: "Cancelled", className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border" },
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

  const s = zonedParts(startAt);
  const e = zonedParts(endAt);
  if (s.year !== e.year || s.month !== e.month || s.day !== e.day)
    out.push("A booking must start and end on the same day.");

  const endMinutes = e.hour * 60 + e.minute;
  if (s.hour < a.openHour || endMinutes > a.closeHour * 60)
    out.push(`${labelHour(a.openHour)}–${labelHour(a.closeHour)} only.`);

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

export function fmtSlot(start: Date, end: Date) {
  const d = start.toLocaleDateString("en-PH", {
    timeZone: APP_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = (x: Date) =>
    x.toLocaleTimeString("en-PH", {
      timeZone: APP_TZ,
      hour: "numeric",
      minute: "2-digit",
    });
  return `${d}, ${t(start)}–${t(end)}`;
}

export function fmtDateTime(d: Date) {
  return d.toLocaleString("en-PH", {
    timeZone: APP_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** YYYY-MM-DD in the browser's local time — used only for an <input min>. */
export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
