import { describe, it, expect } from "vitest";
import { isOrgLocked, trialDaysLeft } from "@/lib/trial";

const now = new Date("2026-06-15T00:00:00Z");
const future = new Date("2026-06-20T00:00:00Z"); // +5d
const past = new Date("2026-06-10T00:00:00Z"); // -5d

describe("isOrgLocked", () => {
  it("ACTIVE is never locked, regardless of trialEndsAt", () => {
    expect(isOrgLocked({ status: "ACTIVE", trialEndsAt: past }, now)).toBe(false);
    expect(isOrgLocked({ status: "ACTIVE", trialEndsAt: null }, now)).toBe(false);
  });

  it("TRIAL with a future trialEndsAt is not locked", () => {
    expect(isOrgLocked({ status: "TRIAL", trialEndsAt: future }, now)).toBe(false);
  });

  it("TRIAL with a past trialEndsAt is locked", () => {
    expect(isOrgLocked({ status: "TRIAL", trialEndsAt: past }, now)).toBe(true);
  });

  it("TRIAL exactly at the boundary is locked", () => {
    expect(isOrgLocked({ status: "TRIAL", trialEndsAt: now }, now)).toBe(true);
  });

  it("TRIAL with no trialEndsAt set is not locked (defensive — bad data shouldn't lock)", () => {
    expect(isOrgLocked({ status: "TRIAL", trialEndsAt: null }, now)).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("returns null for an ACTIVE org", () => {
    expect(trialDaysLeft({ status: "ACTIVE", trialEndsAt: future }, now)).toBeNull();
  });

  it("returns null when trialEndsAt isn't set", () => {
    expect(trialDaysLeft({ status: "TRIAL", trialEndsAt: null }, now)).toBeNull();
  });

  it("counts whole days remaining", () => {
    expect(trialDaysLeft({ status: "TRIAL", trialEndsAt: future }, now)).toBe(5);
  });

  it("is negative once expired", () => {
    expect(trialDaysLeft({ status: "TRIAL", trialEndsAt: past }, now)).toBe(-5);
  });

  it("is 0 at the exact boundary", () => {
    expect(trialDaysLeft({ status: "TRIAL", trialEndsAt: now }, now)).toBe(0);
  });
});
