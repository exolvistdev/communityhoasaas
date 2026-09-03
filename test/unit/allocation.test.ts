import { describe, it, expect } from "vitest";
import { allocateOldestFirst, type OpenInvoice } from "@/lib/allocation";

const inv = (id: string, amount: number, alreadyPaid = 0): OpenInvoice => ({
  id,
  amount,
  alreadyPaid,
});

describe("allocateOldestFirst", () => {
  it("fills invoices in order, no leftover", () => {
    const { allocations, credit } = allocateOldestFirst(3000, [
      inv("a", 1500),
      inv("b", 1500),
    ]);
    expect(allocations).toEqual([
      { invoiceId: "a", amount: 1500 },
      { invoiceId: "b", amount: 1500 },
    ]);
    expect(credit).toBe(0);
  });

  it("stops partway and only partly fills the last invoice", () => {
    const { allocations, credit } = allocateOldestFirst(2000, [
      inv("a", 1500),
      inv("b", 1500),
    ]);
    expect(allocations).toEqual([
      { invoiceId: "a", amount: 1500 },
      { invoiceId: "b", amount: 500 },
    ]);
    expect(credit).toBe(0);
  });

  it("returns the overpayment as credit", () => {
    const { allocations, credit } = allocateOldestFirst(2000, [inv("a", 1500)]);
    expect(allocations).toEqual([{ invoiceId: "a", amount: 1500 }]);
    expect(credit).toBe(500);
  });

  it("respects room already paid on an invoice", () => {
    const { allocations, credit } = allocateOldestFirst(1000, [
      inv("a", 1500, 1200), // only 300 of room
      inv("b", 1500),
    ]);
    expect(allocations).toEqual([
      { invoiceId: "a", amount: 300 },
      { invoiceId: "b", amount: 700 },
    ]);
    expect(credit).toBe(0);
  });

  it("skips a fully-settled invoice", () => {
    const { allocations } = allocateOldestFirst(500, [
      inv("a", 1500, 1500),
      inv("b", 1500),
    ]);
    expect(allocations).toEqual([{ invoiceId: "b", amount: 500 }]);
  });

  it("no open invoices → all credit", () => {
    const { allocations, credit } = allocateOldestFirst(1200, []);
    expect(allocations).toEqual([]);
    expect(credit).toBe(1200);
  });

  it("rounds to cents", () => {
    const { allocations, credit } = allocateOldestFirst(1000.005, [
      inv("a", 1000),
    ]);
    expect(allocations).toEqual([{ invoiceId: "a", amount: 1000 }]);
    expect(credit).toBe(0.01);
  });
});
