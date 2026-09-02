import { describe, it, expect, afterEach, vi } from "vitest";
import { peso, periodLabel, currentPeriod, relativeTime } from "@/lib/format";

describe("peso", () => {
  it("thousands-separates and shows cents by default", () => {
    expect(peso(1500)).toBe("₱1,500.00");
    expect(peso(1234567.5)).toBe("₱1,234,567.50");
  });

  it("drops cents when asked", () => {
    expect(peso(1500, { cents: false })).toBe("₱1,500");
  });

  it("accepts a numeric string", () => {
    expect(peso("2200")).toBe("₱2,200.00");
  });

  it("handles zero and negatives", () => {
    expect(peso(0)).toBe("₱0.00");
    expect(peso(-500)).toBe("₱-500.00");
  });
});

describe("periodLabel", () => {
  it("turns YYYY-MM into a long month + year", () => {
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(periodLabel("2026-01")).toBe("January 2026");
  });
});

describe("currentPeriod", () => {
  it("formats a given date as YYYY-MM", () => {
    expect(currentPeriod(new Date(2026, 8, 3))).toBe("2026-09");
    expect(currentPeriod(new Date(2026, 0, 31))).toBe("2026-01");
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("bucket boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    const ago = (ms: number) => new Date(Date.now() - ms);
    expect(relativeTime(ago(10_000))).toBe("just now");
    expect(relativeTime(ago(5 * 60_000))).toBe("5m ago");
    expect(relativeTime(ago(3 * 3_600_000))).toBe("3h ago");
    expect(relativeTime(ago(2 * 86_400_000))).toBe("2d ago");
  });
});
