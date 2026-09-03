import { describe, it, expect } from "vitest";
import {
  parseStatementRange,
  assembleStatement,
  type PropertyWithLedger,
} from "@/lib/soa";

/* ── fixture builder ──────────────────────────────────────────────── */

type InvSpec = {
  createdAt: string;
  dueDate: string;
  amount: number;
  period?: string | null;
  memo?: string | null;
  status?: "SENT" | "PAID" | "PARTIALLY_PAID" | "VOID" | "OVERDUE";
  /** payment allocations landing on this invoice */
  payments?: { paidAt: string; amount: number; method?: string; reference?: string | null }[];
  /** resident-credit applications against this invoice */
  credits?: { appliedAt: string; amount: number }[];
};

function property(invoices: InvSpec[], creditBalance = 0): PropertyWithLedger {
  return {
    id: "prop-1",
    orgId: "org-1",
    unitNumber: "Blk 1 Lot 1",
    creditBalance,
    org: { name: "Test HOA" },
    homeowners: [{ fullName: "Juan Dela Cruz", isPrimary: true }],
    invoices: invoices.map((i, n) => ({
      id: `inv-${n}`,
      status: i.status ?? "SENT",
      createdAt: new Date(i.createdAt),
      dueDate: new Date(i.dueDate),
      amount: i.amount,
      period: i.period ?? null,
      memo: i.memo ?? null,
      allocations: (i.payments ?? []).map((p, m) => ({
        id: `alloc-${n}-${m}`,
        amount: p.amount,
        payment: {
          paidAt: new Date(p.paidAt),
          method: p.method ?? "CASH",
          reference: p.reference ?? null,
        },
      })),
      creditApplications: (i.credits ?? []).map((c, m) => ({
        id: `ca-${n}-${m}`,
        amount: c.amount,
        appliedAt: new Date(c.appliedAt),
      })),
    })),
  } as unknown as PropertyWithLedger;
}

const allTime = { from: null, to: new Date("2026-12-31T23:59:59Z") };

/* ── parseStatementRange ─────────────────────────────────────────── */

describe("parseStatementRange", () => {
  it("defaults to all-time through now", () => {
    const r = parseStatementRange({});
    expect(r.from).toBeNull();
    expect(r.to.getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("parses from/to and widens 'to' to the end of that day", () => {
    // mid-month dates so local-time normalisation can't roll the date over
    const r = parseStatementRange({ from: "2026-03-10", to: "2026-06-20" });
    expect([r.from?.getFullYear(), r.from?.getMonth(), r.from?.getDate()]).toEqual([
      2026, 2, 10,
    ]);
    expect(r.from?.getHours()).toBe(0);
    expect([r.to.getMonth(), r.to.getDate()]).toEqual([5, 20]);
    expect(r.to.getHours()).toBe(23);
    expect(r.to.getMinutes()).toBe(59);
  });

  it("ignores an unparseable date", () => {
    expect(parseStatementRange({ from: "not-a-date" }).from).toBeNull();
  });
});

/* ── assembleStatement ───────────────────────────────────────────── */

describe("assembleStatement", () => {
  it("runs a charge then a payment to a zero balance", () => {
    const s = assembleStatement(
      property([
        {
          createdAt: "2026-09-01",
          dueDate: "2026-09-15",
          amount: 1500,
          period: "2026-09",
          payments: [{ paidAt: "2026-09-10", amount: 1500, method: "GCASH" }],
        },
      ]),
      allTime
    );
    expect(s.lines.map((l) => l.balance)).toEqual([1500, 0]);
    expect(s.closingBalance).toBe(0);
    expect(s.lines[0].description).toContain("September 2026");
    expect(s.lines[1].description).toContain("gcash");
  });

  it("orders a same-instant charge before its payment", () => {
    const s = assembleStatement(
      property([
        {
          createdAt: "2026-09-01T00:00:00Z",
          dueDate: "2026-09-15",
          amount: 1000,
          payments: [{ paidAt: "2026-09-01T00:00:00Z", amount: 400 }],
        },
      ]),
      allTime
    );
    expect(s.lines.map((l) => l.kind)).toEqual(["charge", "payment"]);
    expect(s.closingBalance).toBe(600);
  });

  it("carries pre-window activity into the opening balance", () => {
    const s = assembleStatement(
      property([
        { createdAt: "2026-07-01", dueDate: "2026-07-15", amount: 1500, period: "2026-07" },
        { createdAt: "2026-09-01", dueDate: "2026-09-15", amount: 1500, period: "2026-09" },
      ]),
      { from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-09-30T23:59:59Z") }
    );
    expect(s.openingBalance).toBe(1500);
    expect(s.lines).toHaveLength(1);
    expect(s.closingBalance).toBe(3000);
  });

  it("skips VOID invoices entirely", () => {
    const s = assembleStatement(
      property([
        { createdAt: "2026-09-01", dueDate: "2026-09-15", amount: 1500, status: "VOID" },
        { createdAt: "2026-09-02", dueDate: "2026-09-15", amount: 1000 },
      ]),
      allTime
    );
    expect(s.lines).toHaveLength(1);
    expect(s.closingBalance).toBe(1000);
  });

  it("buckets an unpaid balance by the age of its due date", () => {
    const asOf = new Date("2026-09-30T00:00:00Z");
    const s = assembleStatement(
      property([
        { createdAt: "2026-09-20", dueDate: "2026-10-05", amount: 100 }, // not yet due
        { createdAt: "2026-09-10", dueDate: "2026-09-20", amount: 200 }, // 10 days
        { createdAt: "2026-07-01", dueDate: "2026-07-20", amount: 300 }, // ~71 days
      ]),
      { from: null, to: asOf }
    );
    expect(s.aging.current).toBe(100);
    expect(s.aging.d1_30).toBe(200);
    expect(s.aging.d61_90).toBe(300);
    expect(s.aging.d31_60).toBe(0);
  });

  it("renders a resident-credit-applied line and surfaces the credit balance", () => {
    const s = assembleStatement(
      property(
        [
          {
            createdAt: "2026-09-01",
            dueDate: "2026-09-15",
            amount: 1500,
            period: "2026-09",
            payments: [{ paidAt: "2026-09-05", amount: 1000, method: "GCASH" }],
            credits: [{ appliedAt: "2026-09-02", amount: 500 }],
          },
        ],
        750 // unapplied credit carried on the property
      ),
      allTime
    );
    const descs = s.lines.map((l) => l.description);
    expect(descs).toContain("Resident credit applied");
    expect(s.closingBalance).toBe(0); // 1500 − 1000 payment − 500 credit
    expect(s.creditBalance).toBe(750);
    // credit line sorts by appliedAt (Sep 2), before the Sep 5 payment
    expect(s.lines.map((l) => l.kind)).toEqual(["charge", "payment", "payment"]);
    expect(s.lines[1].description).toBe("Resident credit applied");
  });

  it("counts credit applications toward aging", () => {
    const s = assembleStatement(
      property([
        {
          createdAt: "2026-08-01",
          dueDate: "2026-08-15",
          amount: 1000,
          credits: [{ appliedAt: "2026-08-20", amount: 1000 }],
        },
      ]),
      { from: null, to: new Date("2026-09-15T00:00:00Z") }
    );
    const total =
      s.aging.current + s.aging.d1_30 + s.aging.d31_60 + s.aging.d61_90 + s.aging.d90plus;
    expect(total).toBe(0);
  });

  it("counts only payments on or before the as-of date for aging", () => {
    const s = assembleStatement(
      property([
        {
          createdAt: "2026-08-01",
          dueDate: "2026-08-15",
          amount: 1000,
          payments: [{ paidAt: "2026-10-01", amount: 1000 }], // after as-of
        },
      ]),
      { from: null, to: new Date("2026-09-15T00:00:00Z") }
    );
    const totalAging =
      s.aging.current + s.aging.d1_30 + s.aging.d31_60 + s.aging.d61_90 + s.aging.d90plus;
    expect(totalAging).toBe(1000);
  });
});
