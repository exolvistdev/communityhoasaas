// Pure helpers for the interactive report charts — safe to import from client
// components. A chart click sets a filter; these narrow the table to match.

import type { Aging } from "@/lib/soa";

export type AgingBucketKey = keyof Aging;

export const AGING_BUCKET_LABEL: Record<AgingBucketKey, string> = {
  current: "Current",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90plus: "90+ days",
};

/**
 * Keep only rows carrying a balance in the selected aging bucket. Works for both
 * the receivables (units) and payables (vendors) tables — both expose `aging`.
 */
export function filterByAgingBucket<T extends { aging: Aging }>(
  rows: T[],
  bucket: AgingBucketKey | null
): T[] {
  if (!bucket) return rows;
  return rows.filter((r) => r.aging[bucket] > 0.005);
}

/** The one selected month's row of a `{ key }`-shaped series, or null. */
export function pickMonth<T extends { key: string }>(
  series: T[],
  key: string | null
): T | null {
  if (!key) return null;
  return series.find((m) => m.key === key) ?? null;
}
