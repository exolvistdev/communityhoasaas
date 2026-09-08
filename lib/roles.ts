import type { UserRole } from "@prisma/client";

/** Plain-English role labels, phrased to slot into "…added you as {label}". */
export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "an admin",
  TREASURER: "the treasurer",
  BOARD_MEMBER: "a board member",
  GUARD: "gate security",
  HOMEOWNER: "a resident",
};
