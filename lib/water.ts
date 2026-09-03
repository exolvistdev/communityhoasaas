// Pure water-billing helpers — safe to import from client components.

import type { WaterSource } from "@prisma/client";

/** Whether the HOA meters & bills water through the system (vs. hidden). */
export function waterMetered(source: WaterSource): boolean {
  return source === "INTERNAL" || source === "EXTERNAL_BULK";
}

export const WATER_SOURCE_OPTIONS: {
  value: Exclude<WaterSource, "UNSET">;
  label: string;
  hint: string;
}[] = [
  {
    value: "INTERNAL",
    label: "The HOA runs its own water source",
    hint: "A deep well or a bulk connection the HOA manages — you set the rates and meter each unit.",
  },
  {
    value: "EXTERNAL_BULK",
    label: "A water utility, through one master meter",
    hint: "Maynilad / Manila Water / Laguna Water / Prime Water bills the HOA one bill; the HOA sub-meters each unit and divides it.",
  },
  {
    value: "EXTERNAL_DIRECT",
    label: "A water utility, one account per lot",
    hint: "Each home has its own utility account and pays the provider directly — the HOA isn't involved in water billing.",
  },
];


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
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export const WATER_LOSS_POLICY_OPTIONS: {
  value: "DISTRIBUTE" | "ABSORB";
  label: string;
  hint: string;
}[] = [
  {
    value: "DISTRIBUTE",
    label: "Residents cover the whole bill",
    hint: "System loss (leaks, the meter gap) is spread across units in proportion to use — the HOA collects exactly what the utility charged.",
  },
  {
    value: "ABSORB",
    label: "The HOA absorbs the loss",
    hint: "Residents pay only for their own metered use; the HOA funds the difference between the bulk bill and the sub-meter total.",
  },
];

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

/** Compact one-line tier breakdown for an invoice memo: "10@₱20 + 8@₱30 + ₱150 service". */
export function bandBreakdownText(
  consumption: number,
  bands: RateBand[],
  serviceCharge: number
): string {
  const parts = bandBreakdown(consumption, bands).map((b) => {
    const price = b.m3 ? Math.round((b.amount / b.m3) * 100) / 100 : 0;
    return `${b.m3}@₱${price}`;
  });
  if (serviceCharge > 0) parts.push(`₱${r2(serviceCharge)} service`);
  return parts.join(" + ");
}

/* ─────────────────── EXTERNAL_BULK allocation ──────────────────── */

export type AllocateUnit = { id: string; consumption: number };

export type AllocateRow = {
  unitId: string;
  consumption: number; // the unit's own metered use
  billedConsumption: number; // use + its share of system loss (DISTRIBUTE)
  amount: number; // billedConsumption × rate + admin fee
};

export type AllocateBulkResult = {
  effectiveRate: number; // ₱ per m³ = bulkAmount / sourceConsumption
  meteredConsumption: number; // Σ unit consumption
  commonConsumption: number; // Σ common-area meters (0 until slice 4)
  sourceConsumption: number; // master-meter m³ (falls back to metered + common)
  systemLoss: number; // source − metered − common, floored at 0
  systemLossPct: number;
  rows: AllocateRow[];
  residentTotal: number; // Σ row.amount
  shortfall: number; // HOA-funded loss cost (ABSORB only)
  error?: string;
};

/**
 * Split a utility master-meter bill across the unit sub-meters for a period.
 *
 * DISTRIBUTE — each unit pays for its use plus a pro-rata share of system loss,
 * so residents collectively pay exactly `bulkAmount + Σ admin fee`. A rounding
 * remainder is nudged onto the largest-consumption unit for an exact match.
 *
 * ABSORB — each unit pays only for its metered use; `shortfall` is the loss cost
 * the HOA funds.
 */
export function allocateBulk(input: {
  bulkAmount: number;
  sourceConsumption?: number | null;
  units: AllocateUnit[];
  commonConsumption?: number;
  lossPolicy: "DISTRIBUTE" | "ABSORB";
  adminFeeFlat?: number;
}): AllocateBulkResult {
  const bulkAmount = Math.max(0, input.bulkAmount || 0);
  const adminFeeFlat = Math.max(0, input.adminFeeFlat || 0);
  const commonConsumption = r2(Math.max(0, input.commonConsumption || 0));
  const units = input.units.map((u) => ({
    id: u.id,
    consumption: Math.max(0, u.consumption || 0),
  }));
  const meteredConsumption = r2(units.reduce((s, u) => s + u.consumption, 0));

  const base: AllocateBulkResult = {
    effectiveRate: 0,
    meteredConsumption,
    commonConsumption,
    sourceConsumption: 0,
    systemLoss: 0,
    systemLossPct: 0,
    rows: [],
    residentTotal: 0,
    shortfall: 0,
  };

  if (meteredConsumption <= 0)
    return { ...base, error: "Enter this period's unit readings first." };

  const sourceConsumption =
    input.sourceConsumption && input.sourceConsumption > 0
      ? r2(input.sourceConsumption)
      : r2(meteredConsumption + commonConsumption);

  const effectiveRate = r4(bulkAmount / Math.max(sourceConsumption, 0.001));
  const systemLoss = r2(
    Math.max(0, sourceConsumption - meteredConsumption - commonConsumption)
  );
  const systemLossPct =
    sourceConsumption > 0 ? r2((systemLoss / sourceConsumption) * 100) : 0;

  let rows: AllocateRow[];
  let shortfall = 0;

  if (input.lossPolicy === "DISTRIBUTE") {
    rows = units.map((u) => {
      const billedConsumption = r2(
        u.consumption + (systemLoss * u.consumption) / meteredConsumption
      );
      return {
        unitId: u.id,
        consumption: r2(u.consumption),
        billedConsumption,
        amount: r2(billedConsumption * effectiveRate + adminFeeFlat),
      };
    });
    // Remainder rule — force Σ amount == bulkAmount + n·fee exactly.
    const target = r2(bulkAmount + units.length * adminFeeFlat);
    const remainder = r2(target - rows.reduce((s, r) => s + r.amount, 0));
    if (remainder !== 0 && rows.length) {
      let idx = 0;
      for (let i = 1; i < units.length; i++) {
        const bigger = units[i].consumption > units[idx].consumption;
        const tie =
          units[i].consumption === units[idx].consumption &&
          units[i].id < units[idx].id;
        if (bigger || tie) idx = i;
      }
      rows[idx] = { ...rows[idx], amount: r2(rows[idx].amount + remainder) };
    }
  } else {
    rows = units.map((u) => ({
      unitId: u.id,
      consumption: r2(u.consumption),
      billedConsumption: r2(u.consumption),
      amount: r2(u.consumption * effectiveRate + adminFeeFlat),
    }));
    shortfall = r2(systemLoss * effectiveRate);
  }

  return {
    effectiveRate,
    meteredConsumption,
    commonConsumption,
    sourceConsumption,
    systemLoss,
    systemLossPct,
    rows,
    residentTotal: r2(rows.reduce((s, r) => s + r.amount, 0)),
    shortfall,
  };
}
