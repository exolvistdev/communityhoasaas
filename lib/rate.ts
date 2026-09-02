import type { PropertyType } from "@prisma/client";

// Pure rate-resolution helpers — safe to import from client components.

export type TypeRateDefaults = {
  typeRateResidential: number | null;
  typeRateCommercial: number | null;
  typeRateTownhouse: number | null;
};

/** Organization column that holds the default for a given property type. */
export const TYPE_RATE_FIELD: Record<PropertyType, keyof TypeRateDefaults> = {
  RESIDENTIAL: "typeRateResidential",
  COMMERCIAL: "typeRateCommercial",
  TOWNHOUSE: "typeRateTownhouse",
};

export const PROPERTY_TYPES: PropertyType[] = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "TOWNHOUSE",
];

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  TOWNHOUSE: "Townhouse",
};

/** Normalise a raw Organization row (Decimal | null columns) to plain numbers. */
export function toTypeRateDefaults(o: {
  typeRateResidential: unknown;
  typeRateCommercial: unknown;
  typeRateTownhouse: unknown;
}): TypeRateDefaults {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    typeRateResidential: n(o.typeRateResidential),
    typeRateCommercial: n(o.typeRateCommercial),
    typeRateTownhouse: n(o.typeRateTownhouse),
  };
}

/** The org's configured default monthly rate for a property type, or null. */
export function typeDefaultRate(
  defaults: TypeRateDefaults,
  type: PropertyType
): number | null {
  const v = defaults[TYPE_RATE_FIELD[type]];
  return v == null ? null : Number(v);
}

/**
 * Resolve a property's monthly rate from the three sources, in priority order:
 *   1. assigned rate plan  2. explicit custom rate  3. the org's type default
 * Returns null when none apply — the caller should reject.
 */
export function resolvePropertyRate(
  input: {
    ratePlanRate?: number | null;
    customRate?: number | null;
    type: PropertyType;
  },
  defaults: TypeRateDefaults
): number | null {
  if (input.ratePlanRate != null) return input.ratePlanRate;
  if (input.customRate != null) return input.customRate;
  return typeDefaultRate(defaults, input.type);
}
