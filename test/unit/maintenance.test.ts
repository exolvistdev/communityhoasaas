import { describe, it, expect } from "vitest";
import {
  canTransitionMaintenance,
  isMaintenanceCategory,
  MAINTENANCE_OPEN_STATUSES,
} from "@/lib/maintenance";

describe("canTransitionMaintenance — staff", () => {
  const staff = (from: any, to: any) => canTransitionMaintenance(from, to, "staff");

  it("OPEN can be acknowledged, started, resolved or cancelled", () => {
    expect(staff("OPEN", "ACKNOWLEDGED")).toBe(true);
    expect(staff("OPEN", "IN_PROGRESS")).toBe(true);
    expect(staff("OPEN", "RESOLVED")).toBe(true);
    expect(staff("OPEN", "CANCELLED")).toBe(true);
  });
  it("OPEN cannot jump straight to CLOSED", () => {
    expect(staff("OPEN", "CLOSED")).toBe(false);
  });
  it("RESOLVED can be closed or reopened", () => {
    expect(staff("RESOLVED", "CLOSED")).toBe(true);
    expect(staff("RESOLVED", "IN_PROGRESS")).toBe(true);
    expect(staff("RESOLVED", "OPEN")).toBe(false);
  });
  it("a closed request can only be reopened to IN_PROGRESS", () => {
    expect(staff("CLOSED", "IN_PROGRESS")).toBe(true);
    expect(staff("CLOSED", "RESOLVED")).toBe(false);
  });
  it("no-op transitions are rejected", () => {
    expect(staff("IN_PROGRESS", "IN_PROGRESS")).toBe(false);
  });
});

describe("canTransitionMaintenance — resident", () => {
  const res = (from: any, to: any) => canTransitionMaintenance(from, to, "resident");

  it("can cancel while open or acknowledged", () => {
    expect(res("OPEN", "CANCELLED")).toBe(true);
    expect(res("ACKNOWLEDGED", "CANCELLED")).toBe(true);
  });
  it("cannot cancel once work has started", () => {
    expect(res("IN_PROGRESS", "CANCELLED")).toBe(false);
  });
  it("cannot set any other status", () => {
    expect(res("OPEN", "RESOLVED")).toBe(false);
    expect(res("OPEN", "IN_PROGRESS")).toBe(false);
  });
});

describe("misc", () => {
  it("isMaintenanceCategory", () => {
    expect(isMaintenanceCategory("PLUMBING")).toBe(true);
    expect(isMaintenanceCategory("plumbing")).toBe(false);
  });
  it("open statuses are the three active ones", () => {
    expect(MAINTENANCE_OPEN_STATUSES.sort()).toEqual(
      ["ACKNOWLEDGED", "IN_PROGRESS", "OPEN"].sort()
    );
  });
});
