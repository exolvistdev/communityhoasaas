import { describe, it, expect } from "vitest";
import {
  zonedParts,
  zonedInstant,
  zonedDateInput,
  labelHour,
  bookingRuleViolations,
} from "@/lib/amenity";

describe("zoned time helpers (Asia/Manila, UTC+8, no DST)", () => {
  it("zonedInstant ↔ zonedParts round-trip", () => {
    const inst = zonedInstant(2026, 9, 3, 14, 30);
    const p = zonedParts(inst);
    expect(p).toMatchObject({ year: 2026, month: 9, day: 3, hour: 14, minute: 30 });
  });

  it("a Manila wall time is 8h ahead of UTC", () => {
    // 2026-09-03 00:00 Manila == 2026-09-02 16:00 UTC
    expect(zonedInstant(2026, 9, 3, 0, 0).toISOString()).toBe("2026-09-02T16:00:00.000Z");
  });

  it("zonedDateInput formats the Manila calendar date", () => {
    // 15:00 UTC == 23:00 Manila, same day
    expect(zonedDateInput(new Date("2026-09-03T15:00:00Z"))).toBe("2026-09-03");
    // 17:00 UTC == 01:00 Manila next day
    expect(zonedDateInput(new Date("2026-09-03T17:00:00Z"))).toBe("2026-09-04");
  });
});

describe("labelHour", () => {
  it("renders 12-hour am/pm labels", () => {
    expect(labelHour(0)).toBe("12am");
    expect(labelHour(8)).toBe("8am");
    expect(labelHour(12)).toBe("12pm");
    expect(labelHour(22)).toBe("10pm");
  });
});

describe("bookingRuleViolations", () => {
  const rules = { openHour: 8, closeHour: 22, minNoticeHours: 24, maxHours: 6 };
  const now = new Date("2026-09-03T00:00:00Z");
  // helper: a Manila-day slot on 2026-09-10
  const slot = (h1: number, h2: number) => ({
    startAt: zonedInstant(2026, 9, 10, h1),
    endAt: zonedInstant(2026, 9, 10, h2),
  });

  it("no violations for a clean weekday-afternoon booking a week out", () => {
    const { startAt, endAt } = slot(14, 18);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toEqual([]);
  });

  it("flags an end before the start", () => {
    const { startAt, endAt } = slot(18, 14);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain(
      "The end time must be after the start time."
    );
  });

  it("flags a booking in the past", () => {
    const startAt = zonedInstant(2026, 9, 1, 14);
    const endAt = zonedInstant(2026, 9, 1, 16);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain(
      "Pick a time in the future."
    );
  });

  it("flags too-short notice", () => {
    const startAt = new Date(now.getTime() + 3 * 3_600_000);
    const endAt = new Date(now.getTime() + 5 * 3_600_000);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain(
      "Book at least 24 hours ahead."
    );
  });

  it("flags exceeding the max duration", () => {
    const { startAt, endAt } = slot(9, 20);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain(
      "Bookings can be at most 6 hours."
    );
  });

  it("flags a slot outside opening hours", () => {
    const { startAt, endAt } = slot(6, 9);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain("8am–10pm only.");
  });

  it("flags a booking that spans two days", () => {
    const startAt = zonedInstant(2026, 9, 10, 20);
    const endAt = zonedInstant(2026, 9, 11, 1);
    expect(bookingRuleViolations(rules, startAt, endAt, now)).toContain(
      "A booking must start and end on the same day."
    );
  });

  it("rejects an unparseable date", () => {
    expect(
      bookingRuleViolations(rules, new Date("nope"), new Date("nope"), now)
    ).toEqual(["Pick a valid date and time."]);
  });
});
