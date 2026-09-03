// Pure water-billing helpers — safe to import from client components.

/** One tier of a tiered rate. `upToM3: null` means "and above" (the last band). */
export type RateBand = { upToM3: number | null; pricePerM3: number };

/** A sensible Philippine starting point — staff edit these in Settings. */
export const DEFAULT_WATER_BANDS: RateBand[] = [
  { upToM3: 10, pricePerM3: 20 },
  { upToM3: 20, pricePerM3: 30 },
  { upToM3: 30, pricePerM3: 40 },
  { upToM3: null, pricePerM3: 55 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Parse the `Organization.waterRateBands` JSON into a typed array (best effort). */
export function parseRateBands(json: unknown): RateBand[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (b): b is RateBand =>
        b != null &&
        typeof b === "object" &&
        (b.upToM3 === null || typeof (b as any).upToM3 === "number") &&
        typeof (b as any).pricePerM3 === "number"
    )
    .map((b) => ({ upToM3: b.upToM3, pricePerM3: b.pricePerM3 }));
}

/** Human-readable problems with a band set — empty array means it's valid. */
export function validateBands(bands: RateBand[]): string[] {
  const out: string[] = [];
  if (bands.length === 0) return ["Add at least one rate band."];

  let prevCap = 0;
  bands.forEach((b, i) => {
    const last = i === bands.length - 1;
    if (b.pricePerM3 <= 0) out.push(`Band ${i + 1}: price must be greater than 0.`);
    if (last) {
      if (b.upToM3 !== null)
        out.push("The last band must be open-ended (no upper limit).");
    } else {
      if (b.upToM3 === null)
        out.push(`Band ${i + 1}: only the last band can be open-ended.`);
      else if (b.upToM3 <= prevCap)
        out.push(`Band ${i + 1}: the limit must be higher than the band above it.`);
      else prevCap = b.upToM3;
    }
  });
  return out;
}

/** Charge for a consumption (m³) against tiered bands + a fixed service charge. */
export function computeWaterCharge(
  consumption: number,
  bands: RateBand[],
  serviceCharge: number
): number {
  const c = Math.max(0, consumption);
  let charge = Math.max(0, serviceCharge || 0);
  let prevCap = 0;
  for (const b of bands) {
    const cap = b.upToM3 ?? Infinity;
    const inBand = Math.min(c, cap) - prevCap;
    if (inBand > 0) charge += inBand * b.pricePerM3;
    prevCap = cap;
    if (c <= cap) break;
  }
  return r2(charge);
}

/** Per-band breakdown for the invoice memo / a detail view. */
export function bandBreakdown(
  consumption: number,
  bands: RateBand[]
): { label: string; m3: number; amount: number }[] {
  const c = Math.max(0, consumption);
  const rows: { label: string; m3: number; amount: number }[] = [];
  let prevCap = 0;
  for (const b of bands) {
    const cap = b.upToM3 ?? Infinity;
    const m3 = Math.min(c, cap) - prevCap;
    if (m3 > 0)
      rows.push({
        label:
          b.upToM3 === null
            ? `over ${prevCap} m³ @ ₱${b.pricePerM3}`
            : `${prevCap}–${b.upToM3} m³ @ ₱${b.pricePerM3}`,
        m3: r2(m3),
        amount: r2(m3 * b.pricePerM3),
      });
    prevCap = cap;
    if (c <= cap) break;
  }
  return rows;
}

export function formatConsumption(n: number): string {
  return `${Number(n).toFixed(2)} m³`;
}
