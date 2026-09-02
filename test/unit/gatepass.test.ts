import { describe, it, expect } from "vitest";
import {
  extractGatePassCode,
  generateGatePassCode,
  effectiveGatePassStatus,
  validateGatePass,
} from "@/lib/gatepass";

describe("extractGatePassCode", () => {
  it("pulls the code out of a pass URL", () => {
    expect(extractGatePassCode("https://acme.hoa.ph/pass/K7M4PQ2R")).toBe("K7M4PQ2R");
  });
  it("upper-cases and trims a bare code", () => {
    expect(extractGatePassCode("  k7m4pq2r  ")).toBe("K7M4PQ2R");
  });
});

describe("generateGatePassCode", () => {
  it("respects the requested length and the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateGatePassCode(8);
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
      expect(code).not.toMatch(/[ILO01]/);
    }
  });
});

describe("effectiveGatePassStatus", () => {
  it("shows EXPIRED for an active pass past its window", () => {
    expect(
      effectiveGatePassStatus({ status: "ACTIVE", validUntil: new Date(Date.now() - 1000) })
    ).toBe("EXPIRED");
  });
  it("leaves a still-valid active pass alone", () => {
    expect(
      effectiveGatePassStatus({ status: "ACTIVE", validUntil: new Date(Date.now() + 1000) })
    ).toBe("ACTIVE");
  });
  it("does not touch a revoked pass", () => {
    expect(
      effectiveGatePassStatus({ status: "REVOKED", validUntil: new Date(Date.now() - 1000) })
    ).toBe("REVOKED");
  });
});

describe("validateGatePass", () => {
  const now = new Date("2026-09-03T12:00:00Z");
  const window = {
    validFrom: new Date("2026-09-03T08:00:00Z"),
    validUntil: new Date("2026-09-03T20:00:00Z"),
  };

  it("VALID inside the window, active, unused", () => {
    expect(validateGatePass({ status: "ACTIVE", ...window }, now)).toBe("VALID");
  });
  it("REVOKED wins over everything", () => {
    expect(validateGatePass({ status: "REVOKED", ...window }, now)).toBe("REVOKED");
  });
  it("NOT_YET_VALID before the start", () => {
    expect(
      validateGatePass({ status: "ACTIVE", ...window }, new Date("2026-09-03T06:00:00Z"))
    ).toBe("NOT_YET_VALID");
  });
  it("EXPIRED after the end", () => {
    expect(
      validateGatePass({ status: "ACTIVE", ...window }, new Date("2026-09-03T21:00:00Z"))
    ).toBe("EXPIRED");
  });
  it("USED when already scanned", () => {
    expect(
      validateGatePass({ status: "ACTIVE", ...window, usedAt: new Date("2026-09-03T10:00:00Z") }, now)
    ).toBe("USED");
  });
});
