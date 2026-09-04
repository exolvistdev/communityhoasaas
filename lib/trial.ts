import type { OrgStatus } from "@prisma/client";

type TrialOrg = { status: OrgStatus; trialEndsAt: Date | null };

/** A TRIAL org whose trialEndsAt has passed is locked. ACTIVE never is. */
export function isOrgLocked(org: TrialOrg, now: Date = new Date()): boolean {
  return org.status === "TRIAL" && org.trialEndsAt !== null && org.trialEndsAt <= now;
}

/** Whole days left in the trial (negative once expired). Null if not on trial. */
export function trialDaysLeft(org: TrialOrg, now: Date = new Date()): number | null {
  if (org.status !== "TRIAL" || !org.trialEndsAt) return null;
  return Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
}
