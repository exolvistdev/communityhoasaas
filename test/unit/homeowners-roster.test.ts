import { describe, it, expect } from "vitest";
import { rollUpHomeowners } from "@/lib/reports";
import type { Aging } from "@/lib/soa";

const aging = (o: Partial<Aging> = {}): Aging => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
  ...o,
});

const ho = (
  fullName: string,
  propertyId: string,
  unitNumber: string,
  opts: {
    userId?: string;
    acceptedAt?: Date | null;
    email?: string | null;
    phone?: string | null;
  } = {}
) => ({
  fullName,
  email: opts.email ?? null,
  phone: opts.phone ?? null,
  user:
    opts.userId != null
      ? { id: opts.userId, acceptedAt: opts.acceptedAt ?? null }
      : null,
  property: { id: propertyId, unitNumber },
});

const stmt = (propertyId: string, closingBalance: number, ag: Aging = aging()) => ({
  propertyId,
  closingBalance,
  aging: ag,
});

describe("rollUpHomeowners", () => {
  it("groups one owner across units and sums their balances", () => {
    const r = rollUpHomeowners(
      [
        ho("Juan", "p1", "Blk 1 Lot 1", { userId: "u1", acceptedAt: new Date() }),
        ho("Juan", "p3", "Blk 1 Lot 3", { userId: "u1", acceptedAt: new Date() }),
      ],
      [stmt("p1", 1500, aging({ current: 1500 })), stmt("p3", 500, aging({ d31_60: 500 }))]
    );
    expect(r.count).toBe(1);
    expect(r.rows[0].units).toEqual(["Blk 1 Lot 1", "Blk 1 Lot 3"]);
    expect(r.rows[0].balance).toBe(2000);
    expect(r.rows[0].status).toBe("overdue"); // p3 is past due
    expect(r.multiUnit).toBe(1);
  });

  it("derives status: current / partial / overdue", () => {
    const r = rollUpHomeowners(
      [
        ho("A", "pa", "A"),
        ho("B", "pb", "B"),
        ho("C", "pc", "C"),
      ],
      [
        stmt("pa", 0),
        stmt("pb", 900, aging({ current: 900 })), // owed, not yet due
        stmt("pc", 300, aging({ d1_30: 300 })), // past due
      ]
    );
    const byName = Object.fromEntries(r.rows.map((x) => [x.name, x.status]));
    expect(byName).toEqual({ A: "current", B: "partial", C: "overdue" });
    expect(r.byStatus).toEqual({ current: 1, partial: 1, overdue: 1 });
  });

  it("maps portal + contact completeness", () => {
    const r = rollUpHomeowners(
      [
        ho("Signed", "p1", "1", { userId: "u1", acceptedAt: new Date(), email: "a@x.ph", phone: "09" }),
        ho("Invited", "p2", "2", { userId: "u2", acceptedAt: null, email: "b@x.ph" }),
        ho("Nologin", "p3", "3"),
      ],
      [stmt("p1", 0), stmt("p2", 0), stmt("p3", 0)]
    );
    const by = Object.fromEntries(
      r.rows.map((x) => [x.name, { portal: x.portal, contact: x.contactComplete }])
    );
    expect(by.Signed).toEqual({ portal: "Signed in", contact: true });
    expect(by.Invited).toEqual({ portal: "Never signed in", contact: false });
    expect(by.Nologin).toEqual({ portal: "Never signed in", contact: false });
  });

  it("groups unlinked homeowners by name", () => {
    const r = rollUpHomeowners(
      [ho("Same Name", "p1", "1"), ho("Same Name", "p2", "2")],
      [stmt("p1", 0), stmt("p2", 0)]
    );
    expect(r.count).toBe(1);
    expect(r.rows[0].units).toEqual(["1", "2"]);
  });
});
