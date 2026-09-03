import { describe, it, expect } from "vitest";
import { rollUpVendorSpend } from "@/lib/reports";

const range = {
  from: new Date("2026-09-01T00:00:00+08:00"),
  to: new Date("2026-09-30T23:59:59+08:00"),
};

const names = new Map([
  ["5100", "Utilities"],
  ["5300", "Security"],
]);

const bill = (
  vendorId: string,
  vendorName: string,
  code: string,
  amount: number,
  payments: { amount: number; paidAt: string }[]
) => ({
  amount,
  expenseAccountCode: code,
  vendor: { id: vendorId, name: vendorName },
  payments: payments.map((p) => ({ amount: p.amount, paidAt: new Date(p.paidAt) })),
});

describe("rollUpVendorSpend", () => {
  it("rolls billed / paid-in-period / open balance up per vendor, ranked by billed", () => {
    const r = rollUpVendorSpend(
      [
        bill("v1", "GreenScape", "5100", 4500, [
          { amount: 2000, paidAt: "2026-09-10T04:00:00Z" },
        ]),
        bill("v2", "Metro Guard", "5300", 12000, [
          { amount: 12000, paidAt: "2026-08-01T04:00:00Z" }, // paid before the period
        ]),
      ],
      range,
      names
    );

    expect(r.vendors.map((v) => v.vendorName)).toEqual(["Metro Guard", "GreenScape"]);
    const green = r.vendors.find((v) => v.vendorId === "v1")!;
    expect(green.category).toBe("Utilities");
    expect(green.totalBilled).toBe(4500);
    expect(green.totalPaid).toBe(2000); // only the in-period payment
    expect(green.openBalance).toBe(2500); // 4500 − 2000 (all payments)

    const guard = r.vendors.find((v) => v.vendorId === "v2")!;
    expect(guard.totalPaid).toBe(0); // payment was before the period
    expect(guard.openBalance).toBe(0);

    expect(r.totalBilled).toBe(16500);
    expect(r.totalPaid).toBe(2000);
    expect(r.openBalance).toBe(2500);
  });

  it("labels a vendor 'Mixed' when its bills span more than one account", () => {
    const r = rollUpVendorSpend(
      [
        bill("v1", "Acme", "5100", 100, []),
        bill("v1", "Acme", "5300", 200, []),
      ],
      range,
      names
    );
    expect(r.vendors[0].category).toBe("Mixed");
  });

  it("groups spend by category and ranks the top vendors", () => {
    const r = rollUpVendorSpend(
      [
        bill("v1", "A", "5100", 300, []),
        bill("v2", "B", "5100", 100, []),
        bill("v3", "C", "5300", 500, []),
      ],
      range,
      names
    );
    expect(r.byCategory).toEqual([
      { name: "Security", value: 500 },
      { name: "Utilities", value: 400 },
    ]);
    expect(r.topVendors.map((v) => v.name)).toEqual(["C", "A", "B"]);
  });

  it("falls back to the raw code when an account has no name", () => {
    const r = rollUpVendorSpend([bill("v1", "A", "5999", 10, [])], range, names);
    expect(r.vendors[0].category).toBe("5999");
    expect(r.byCategory[0].name).toBe("5999");
  });
});
