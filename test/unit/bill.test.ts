import { describe, it, expect, afterEach, vi } from "vitest";
import { billStatus, effectiveBillStatus } from "@/lib/bill";

describe("billStatus", () => {
  it("nothing paid → UNPAID", () => {
    expect(billStatus(4500, 0)).toBe("UNPAID");
  });
  it("some paid → PARTIALLY_PAID", () => {
    expect(billStatus(4500, 2000)).toBe("PARTIALLY_PAID");
  });
  it("fully paid → PAID", () => {
    expect(billStatus(4500, 4500)).toBe("PAID");
  });
  it("overpaid (rounding slop) → PAID", () => {
    expect(billStatus(4500, 4500.004)).toBe("PAID");
    expect(billStatus(4500, 4501)).toBe("PAID");
  });
  it("a sub-cent payment is still UNPAID", () => {
    expect(billStatus(4500, 0.004)).toBe("UNPAID");
  });
});

describe("effectiveBillStatus", () => {
  afterEach(() => vi.useRealTimers());

  it("shows OVERDUE for an unpaid bill past its due date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    expect(
      effectiveBillStatus({ status: "UNPAID", dueDate: new Date("2026-09-10") })
    ).toBe("OVERDUE");
    expect(
      effectiveBillStatus({ status: "PARTIALLY_PAID", dueDate: new Date("2026-09-10") })
    ).toBe("OVERDUE");
  });

  it("leaves paid / void / not-yet-due bills alone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    expect(
      effectiveBillStatus({ status: "PAID", dueDate: new Date("2026-09-10") })
    ).toBe("PAID");
    expect(
      effectiveBillStatus({ status: "VOID", dueDate: new Date("2026-09-10") })
    ).toBe("VOID");
    expect(
      effectiveBillStatus({ status: "UNPAID", dueDate: new Date("2026-09-30") })
    ).toBe("UNPAID");
  });
});
