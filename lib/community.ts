// Pure community-type helpers — safe to import from client components.

import type { CommunityType } from "@prisma/client";

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
