import { describe, it, expect, afterEach, vi } from "vitest";
import { effectiveStatus, invoicePaid } from "@/lib/invoice";

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

describe("invoicePaid", () => {
  it("sums payment allocations", () => {
    expect(
      invoicePaid({ allocations: [{ amount: "1000" }, { amount: 500.5 }] })
    ).toBe(1500.5);
  });

  it("adds resident credit applied to the invoice", () => {
    expect(
      invoicePaid({
        allocations: [{ amount: 1000 }],
        creditApplications: [{ amount: 500 }],
      })
    ).toBe(1500);
  });

  it("is zero with nothing applied", () => {
    expect(invoicePaid({ allocations: [] })).toBe(0);
  });
});
