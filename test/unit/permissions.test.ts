import { describe, it, expect } from "vitest";
import type { UserRole } from "@prisma/client";
import {
  can,
  isStaff,
  denyUnlessRole,
  STAFF_ROLES,
  PERMISSION_DENIED,
} from "@/lib/permissions";

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "TREASURER",
  "BOARD_MEMBER",
  "GUARD",
  "HOMEOWNER",
];

describe("isStaff", () => {
  it("is true for the three staff roles only", () => {
    expect(ALL_ROLES.filter(isStaff).sort()).toEqual(
      ["ADMIN", "BOARD_MEMBER", "TREASURER"].sort()
    );
  });

  it("STAFF_ROLES has no GUARD or HOMEOWNER", () => {
    expect(STAFF_ROLES).not.toContain("GUARD");
    expect(STAFF_ROLES).not.toContain("HOMEOWNER");
  });
});

describe("can", () => {
  it("only ADMIN may write settings or manage the team", () => {
    for (const r of ALL_ROLES) {
      expect(can(r, "settings:write")).toBe(r === "ADMIN");
      expect(can(r, "team:write")).toBe(r === "ADMIN");
    }
  });

  it("ADMIN and TREASURER may write billing; nobody else", () => {
    expect(can("ADMIN", "billing:write")).toBe(true);
    expect(can("TREASURER", "billing:write")).toBe(true);
    expect(can("BOARD_MEMBER", "billing:write")).toBe(false);
    expect(can("GUARD", "billing:write")).toBe(false);
    expect(can("HOMEOWNER", "billing:write")).toBe(false);
  });

  it("BOARD_MEMBER may write announcements but not billing", () => {
    expect(can("BOARD_MEMBER", "announcement:write")).toBe(true);
    expect(can("BOARD_MEMBER", "billing:write")).toBe(false);
  });

  it("never grants anything to GUARD or HOMEOWNER", () => {
    const actions = [
      "billing:write",
      "property:write",
      "gatepass:write",
      "announcement:write",
      "settings:write",
      "team:write",
      "marketplace:moderate",
      "amenity:manage",
      "document:write",
    ] as const;
    for (const a of actions) {
      expect(can("GUARD", a)).toBe(false);
      expect(can("HOMEOWNER", a)).toBe(false);
    }
  });
});

describe("denyUnlessRole", () => {
  it("returns null when allowed", () => {
    expect(denyUnlessRole("ADMIN", "settings:write")).toBeNull();
  });

  it("returns the shared denial object when not allowed", () => {
    expect(denyUnlessRole("HOMEOWNER", "settings:write")).toBe(PERMISSION_DENIED);
    expect(PERMISSION_DENIED.ok).toBe(false);
  });
});
