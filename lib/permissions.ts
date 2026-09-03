import type { UserRole } from "@prisma/client";

// Pure permission logic — safe to import from client components.

export type Action =
  | "billing:write"
  | "property:write"
  | "gatepass:write"
  | "announcement:write"
  | "settings:write"
  | "team:write"
  | "marketplace:moderate"
  | "amenity:manage"
  | "document:write"
  | "violation:manage";

const PERMISSIONS: Record<Action, UserRole[]> = {
  "billing:write": ["ADMIN", "TREASURER"],
  "property:write": ["ADMIN", "TREASURER"],
  "gatepass:write": ["ADMIN", "TREASURER"],
  "announcement:write": ["ADMIN", "TREASURER", "BOARD_MEMBER"],
  "settings:write": ["ADMIN"],
  "team:write": ["ADMIN"],
  "marketplace:moderate": ["ADMIN", "BOARD_MEMBER"],
  "amenity:manage": ["ADMIN", "TREASURER", "BOARD_MEMBER"],
  "document:write": ["ADMIN", "TREASURER", "BOARD_MEMBER"],
  "violation:manage": ["ADMIN", "BOARD_MEMBER", "TREASURER"],
};

export const STAFF_ROLES: UserRole[] = ["ADMIN", "TREASURER", "BOARD_MEMBER"];

export function isStaff(role: UserRole) {
  return STAFF_ROLES.includes(role);
}

export function can(role: UserRole, action: Action) {
  return PERMISSIONS[action].includes(role);
}

export const PERMISSION_DENIED = {
  ok: false as const,
  error: "You don't have permission to do that.",
};

/** Sync guard for server actions that already hold the user's role. */
export function denyUnlessRole(role: UserRole, action: Action) {
  return can(role, action) ? null : PERMISSION_DENIED;
}
