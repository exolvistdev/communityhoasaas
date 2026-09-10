// Single source of truth for the platform's per-property subscription pricing.
// The marketing pricing page, the onboarding estimate, and the in-app "Plan"
// row all read from here so the numbers can never drift apart.

export type PricingBand = { min: number; max: number | null; rate: number };

/** ₱ per property per month, by active-property count. Ascending, non-overlapping. */
export const PRICING_BANDS: PricingBand[] = [
  { min: 1, max: 500, rate: 7 },
  { min: 501, max: 1000, rate: 6 },
  { min: 1001, max: null, rate: 5 },
];

const ENTRY_RATE = PRICING_BANDS[0].rate;

/** ₱ per property per month for a given active-property count. 0 (or fewer) → the entry rate. */
export function ratePerProperty(count: number): number {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1) return ENTRY_RATE;
  const band = PRICING_BANDS.find(
    (b) => n >= b.min && (b.max === null || n <= b.max)
  );
  return band ? band.rate : ENTRY_RATE;
}

/** Monthly subscription estimate for a property count. */
export function monthlyEstimate(count: number): {
  count: number;
  rate: number;
  total: number;
} {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rate = ratePerProperty(n);
  return { count: n, rate, total: n * rate };
}

/** "1 – 500 properties" / "1,001+" (pass noun="" to drop the trailing word). */
export function bandRangeLabel(b: PricingBand, noun = "properties"): string {
  const lo = b.min.toLocaleString("en-US");
  const range =
    b.max === null ? `${lo}+` : `${lo} – ${b.max.toLocaleString("en-US")}`;
  return noun ? `${range} ${noun}` : range;
}
