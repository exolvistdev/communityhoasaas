// Display vocabulary that changes with the org's community type. Pure — safe to
// import from client components (same rule as lib/rate.ts / lib/vote.ts).
//
// RA 9904 communities (subdivision / village / townhouse) say "HOA",
// "homeowner", "Board of Trustees", "lot". RA 4726 condominiums say
// "condominium corporation", "unit owner", "Board of Directors", "unit". MIXED
// is a neutral fallback for anything that doesn't fit one label.
//
// Server code holds `org` from getCurrentOrgContext() → termsFor(org.communityType).
// Client code reads it from <TermsProvider> via useTerms().

import type { CommunityType } from "@prisma/client";

export type Terms = {
  /** "subdivision" — the community itself, lowercase for mid-sentence use. */
  community: string;
  /** "Subdivision" — sentence-start / heading form. */
  communityCap: string;
  /** "HOA" — the governing body, short form. */
  org: string;
  /** "HOA" — sentence-start form (already caps for HOA; "Condominium corporation" for condos). */
  orgCap: string;
  /** "homeowners' association" — spelled out. */
  orgLong: string;
  /** "homeowner" / "unit owner" — a member, singular lowercase. */
  member: string;
  /** "homeowners" / "unit owners". */
  members: string;
  /** "Homeowner" / "Unit owner". */
  memberCap: string;
  /** "Homeowners" / "Unit owners". */
  membersCap: string;
  /** "lot" / "unit" — a single property, lowercase. */
  unit: string;
  /** "lots" / "units". */
  units: string;
  /** "Board of Trustees" / "Board of Directors". */
  board: string;
  /** "Board" — short form, same for every type. */
  boardShort: string;
  /** "trustee" / "director" — one elected board member. */
  boardMember: string;
  /** "trustees" / "directors". */
  boardMembers: string;
  /** "Chairperson" / "President" — the presiding officer's title. */
  chairTitle: string;
  /** "Vice-Chairperson" / "Vice-President". */
  viceChairTitle: string;
  /** "RA 9904" / "RA 4726" — the governing statute, or "" for MIXED. */
  law: string;
  /** "Magna Carta for Homeowners and Homeowners' Associations" / "Condominium Act", or "". */
  lawName: string;
};

const RA_9904: Omit<Terms, "community" | "communityCap"> = {
  org: "HOA",
  orgCap: "HOA",
  orgLong: "homeowners' association",
  member: "homeowner",
  members: "homeowners",
  memberCap: "Homeowner",
  membersCap: "Homeowners",
  unit: "lot",
  units: "lots",
  board: "Board of Trustees",
  boardShort: "Board",
  boardMember: "trustee",
  boardMembers: "trustees",
  chairTitle: "Chairperson",
  viceChairTitle: "Vice-Chairperson",
  law: "RA 9904",
  lawName: "Magna Carta for Homeowners and Homeowners' Associations",
};

const CONDOMINIUM: Terms = {
  community: "condominium",
  communityCap: "Condominium",
  org: "condominium corporation",
  orgCap: "Condominium corporation",
  orgLong: "condominium corporation",
  member: "unit owner",
  members: "unit owners",
  memberCap: "Unit owner",
  membersCap: "Unit owners",
  unit: "unit",
  units: "units",
  board: "Board of Directors",
  boardShort: "Board",
  boardMember: "director",
  boardMembers: "directors",
  chairTitle: "President",
  viceChairTitle: "Vice-President",
  law: "RA 4726",
  lawName: "Condominium Act",
};

const MIXED: Terms = {
  community: "community",
  communityCap: "Community",
  org: "association",
  orgCap: "Association",
  orgLong: "association",
  member: "member",
  members: "members",
  memberCap: "Member",
  membersCap: "Members",
  unit: "unit",
  units: "units",
  board: "Board",
  boardShort: "Board",
  boardMember: "board member",
  boardMembers: "board members",
  chairTitle: "Chairperson",
  viceChairTitle: "Vice-Chairperson",
  law: "",
  lawName: "",
};

const BY_TYPE: Record<CommunityType, Terms> = {
  SUBDIVISION: { ...RA_9904, community: "subdivision", communityCap: "Subdivision" },
  VILLAGE: { ...RA_9904, community: "village", communityCap: "Village" },
  TOWNHOUSE: {
    ...RA_9904,
    community: "townhouse complex",
    communityCap: "Townhouse complex",
  },
  CONDOMINIUM,
  MIXED,
};

export function termsFor(t: CommunityType): Terms {
  return BY_TYPE[t] ?? BY_TYPE.SUBDIVISION;
}

/** Vocabulary for the classic house-and-lot subdivision — the app's original
 *  wording, used where there is no org in scope (marketing, auth shells). */
export const DEFAULT_TERMS = termsFor("SUBDIVISION");
