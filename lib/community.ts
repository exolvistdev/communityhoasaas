// Pure community-type helpers — safe to import from client components.

import type {
  CommunityType,
  DuesRateMode,
  VoteWeightMode,
} from "@prisma/client";

export const COMMUNITY_TYPES: CommunityType[] = [
  "SUBDIVISION",
  "VILLAGE",
  "TOWNHOUSE",
  "CONDOMINIUM",
  "MIXED",
];

export const COMMUNITY_TYPE_LABEL: Record<CommunityType, string> = {
  SUBDIVISION: "Subdivision",
  VILLAGE: "Village",
  TOWNHOUSE: "Townhouse complex",
  CONDOMINIUM: "Condominium",
  MIXED: "Mixed-use",
};

export const COMMUNITY_TYPE_OPTIONS: {
  value: CommunityType;
  label: string;
  hint: string;
}[] = [
  {
    value: "SUBDIVISION",
    label: "Subdivision",
    hint: "A house-and-lot subdivision governed by a homeowners' association (RA 9904).",
  },
  {
    value: "VILLAGE",
    label: "Village",
    hint: "The same as a subdivision — a village association under RA 9904. Only the wording differs.",
  },
  {
    value: "TOWNHOUSE",
    label: "Townhouse complex",
    hint: "A row of townhouses run by a homeowners' association (RA 9904).",
  },
  {
    value: "CONDOMINIUM",
    label: "Condominium",
    hint: "A condominium project run by a condominium corporation (RA 4726) — unit owners, a Board of Directors, dues by floor area.",
  },
  {
    value: "MIXED",
    label: "Mixed-use",
    hint: "A community that doesn't fit one label — neutral wording throughout.",
  },
];

/**
 * Org defaults implied by the community type at signup. Condominiums (RA 4726)
 * default to per-sqm dues and floor-area-weighted voting; every other type
 * keeps the column defaults. All still editable in Settings afterward.
 */
export function communityTypeDefaults(t: CommunityType): {
  duesRateMode?: DuesRateMode;
  voteWeightMode?: VoteWeightMode;
} {
  if (t === "CONDOMINIUM")
    return { duesRateMode: "PER_SQM", voteWeightMode: "BY_FLOOR_AREA" };
  return {};
}
