import { describe, it, expect, afterEach, vi } from "vitest";
import { effectiveStatus, amountPaid } from "@/lib/invoice";

describe("effectiveStatus", () => {
  afterEach(() => vi.useRealTimers());

  const setNow = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it("flips a past-due unsettled invoice to OVERDUE", () => {
    setNow("2026-09-20T00:00:00Z");
    expect(
      effectiveStatus({ status: "SENT", dueDate: new Date("2026-09-15") })
    ).toBe("OVERDUE");
    expect(
      effectiveStatus({ status: "PARTIALLY_PAID", dueDate: new Date("2026-09-15") })
    ).toBe("OVERDUE");
  });

  it("never overrides PAID or VOID", () => {
    setNow("2026-09-20T00:00:00Z");
    expect(
      effectiveStatus({ status: "PAID", dueDate: new Date("2026-09-15") })
    ).toBe("PAID");
    expect(
      effectiveStatus({ status: "VOID", dueDate: new Date("2026-09-15") })
    ).toBe("VOID");
  });

  it("leaves a not-yet-due invoice alone", () => {
    setNow("2026-09-10T00:00:00Z");
    expect(
      effectiveStatus({ status: "SENT", dueDate: new Date("2026-09-15") })
    ).toBe("SENT");
  });
});

describe("amountPaid", () => {
  it("sums Decimal-ish amounts", () => {
    expect(amountPaid([{ amount: "1000" }, { amount: 500.5 }])).toBe(1500.5);
  });

  it("is zero for no payments", () => {
    expect(amountPaid([])).toBe(0);
  });
});
