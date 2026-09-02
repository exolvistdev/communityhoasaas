import type { LateFeeType } from "@prisma/client";

// Pure late-fee policy helpers — safe to import from client components.

export type LateFeePolicy = {
  lateFeeEnabled: boolean;
  lateFeeType: LateFeeType;
  lateFeeAmount: number;
  lateFeeGraceDays: number;
  lateFeeMaxOccurrences: number;
};

/** The peso late fee for one overdue invoice, rounded to cents. */
export function computeLateFee(
  policy: { lateFeeType: LateFeeType; lateFeeAmount: number },
  remaining: number
) {
  const amt = Number(policy.lateFeeAmount) || 0;
  const raw =
    policy.lateFeeType === "PERCENT" ? (remaining * amt) / 100 : amt;
  return Math.round(raw * 100) / 100;
}

/** One-line human summary of a late-fee policy. */
export function lateFeeSummary(p: LateFeePolicy) {
  if (!p.lateFeeEnabled) return "Off — no late fees are charged.";
  const amt = Number(p.lateFeeAmount) || 0;
  const fee =
    p.lateFeeType === "PERCENT"
      ? `${amt}% of the overdue balance`
      : `₱${amt.toLocaleString("en-PH")}`;
  const grace =
    p.lateFeeGraceDays > 0
      ? `, ${p.lateFeeGraceDays} day${p.lateFeeGraceDays === 1 ? "" : "s"} after the due date`
      : ", the day after it falls due";
  const recur =
    p.lateFeeMaxOccurrences > 1
      ? `, up to ${p.lateFeeMaxOccurrences} times (once a month)`
      : ", once";
  return `${fee}${grace}${recur}.`;
}
