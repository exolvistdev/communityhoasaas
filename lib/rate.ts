import type { PropertyType, DuesRateMode } from "@prisma/client";

// Pure rate-resolution helpers — safe to import from client components.

export type TypeRateDefaults = {
  typeRateResidential: number | null;
  typeRateCommercial: number | null;
  typeRateTownhouse: number | null;
  // added alongside the CONDO_UNIT / PARKING_SLOT property types — optional so
  // older fixtures and callers that only know the original three still type-check
  typeRateCondoUnit?: number | null;
  typeRateParking?: number | null;
};

/** Organization column that holds the by-type default for a property type. */
export const TYPE_RATE_FIELD: Record<PropertyType, keyof TypeRateDefaults> = {
  RESIDENTIAL: "typeRateResidential",
  COMMERCIAL: "typeRateCommercial",
  TOWNHOUSE: "typeRateTownhouse",
  CONDO_UNIT: "typeRateCondoUnit",
  PARKING_SLOT: "typeRateParking",
};

/** Types shown in the by-type default-rate table in Settings. */
export const PROPERTY_TYPES = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "TOWNHOUSE",
] as const satisfies readonly PropertyType[];

/** Every property type, for pickers and CSV import. */
export const ALL_PROPERTY_TYPES: PropertyType[] = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "TOWNHOUSE",
  "CONDO_UNIT",
  "PARKING_SLOT",
];

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  TOWNHOUSE: "Townhouse",
  CONDO_UNIT: "Condo unit",
  PARKING_SLOT: "Parking slot",
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Normalise a raw Organization row (Decimal | null columns) to plain numbers. */
export function toTypeRateDefaults(o: {
  typeRateResidential: unknown;
  typeRateCommercial: unknown;
  typeRateTownhouse: unknown;
  typeRateCondoUnit?: unknown;
  typeRateParking?: unknown;
}): TypeRateDefaults {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    typeRateResidential: n(o.typeRateResidential),
    typeRateCommercial: n(o.typeRateCommercial),
    typeRateTownhouse: n(o.typeRateTownhouse),
    typeRateCondoUnit: n(o.typeRateCondoUnit),
    typeRateParking: n(o.typeRateParking),
  };
}

/** The org's configured by-type default monthly rate, or null. */
export function typeDefaultRate(
  defaults: TypeRateDefaults,
  type: PropertyType
): number | null {
  const v = defaults[TYPE_RATE_FIELD[type]];
  return v == null ? null : Number(v);
}

/** Per-square-metre dues for a unit: ₱/sqm × floor area, or null if either
 *  input is missing / non-positive. */
export function perSqmRate(
  duesRatePerSqm: number | null | undefined,
  floorArea: number | null | undefined
): number | null {
  if (duesRatePerSqm == null || floorArea == null) return null;
  if (duesRatePerSqm <= 0 || floorArea <= 0) return null;
  return r2(duesRatePerSqm * floorArea);
}

export type DuesRateContext = {
  duesRateMode?: DuesRateMode | null;
  duesRatePerSqm?: number | null;
};

/** Pull the per-sqm context off a raw Organization row. */
export function toDuesRateContext(o: {
  duesRateMode: unknown;
  duesRatePerSqm: unknown;
}): DuesRateContext {
  return {
    duesRateMode: (o.duesRateMode as DuesRateMode) ?? "BY_TYPE",
    duesRatePerSqm: o.duesRatePerSqm == null ? null : Number(o.duesRatePerSqm),
  };
}

/**
 * Resolve a property's monthly rate, in priority order:
 *   1. assigned rate plan
 *   2. explicit custom rate
 *   3. per-sqm rate  (only when the org is on PER_SQM and the unit has a floor area)
 *   4. the org's by-type default
 * Returns null when none apply — the caller should reject.
 */
export function resolvePropertyRate(
  input: {
    ratePlanRate?: number | null;
    customRate?: number | null;
    type: PropertyType;
    floorArea?: number | null;
  },
  defaults: TypeRateDefaults,
  ctx: DuesRateContext = {}
): number | null {
  if (input.ratePlanRate != null) return input.ratePlanRate;
  if (input.customRate != null) return input.customRate;
  if (ctx.duesRateMode === "PER_SQM") {
    const perSqm = perSqmRate(ctx.duesRatePerSqm, input.floorArea);
    if (perSqm != null) return perSqm;
  }
  return typeDefaultRate(defaults, input.type);
}
