import { describe, it, expect } from "vitest";
import { termsFor, DEFAULT_TERMS, type Terms } from "@/lib/terms";
import { COMMUNITY_TYPES } from "@/lib/community";

// The exact wording the app used before the terms layer existed. Every
// mechanical "subdivision" → terms.community replacement must be a provable
// no-op for existing (SUBDIVISION) orgs, so this literal is the contract.
const SUBDIVISION_WORDS: Terms = {
  community: "subdivision",
  communityCap: "Subdivision",
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

describe("termsFor", () => {
  it("SUBDIVISION keeps the app's original wording verbatim", () => {
    expect(termsFor("SUBDIVISION")).toEqual(SUBDIVISION_WORDS);
    expect(DEFAULT_TERMS).toEqual(SUBDIVISION_WORDS);
  });

  it("VILLAGE and TOWNHOUSE differ from SUBDIVISION only in the community word", () => {
    const sub = termsFor("SUBDIVISION");
    for (const t of ["VILLAGE", "TOWNHOUSE"] as const) {
      const terms = termsFor(t);
      const { community, communityCap, ...rest } = terms;
      const { community: _c, communityCap: _cc, ...subRest } = sub;
      expect(rest).toEqual(subRest);
      expect(community).not.toBe("subdivision");
      expect(communityCap[0]).toBe(communityCap[0].toUpperCase());
    }
  });

  it("CONDOMINIUM uses RA 4726 vocabulary", () => {
    const c = termsFor("CONDOMINIUM");
    expect(c.community).toBe("condominium");
    expect(c.orgLong).toBe("condominium corporation");
    expect(c.member).toBe("unit owner");
    expect(c.board).toBe("Board of Directors");
    expect(c.boardMember).toBe("director");
    expect(c.chairTitle).toBe("President");
    expect(c.law).toBe("RA 4726");
    expect(c.unit).toBe("unit");
  });

  it("MIXED is neutral and carries no statute", () => {
    const m = termsFor("MIXED");
    expect(m.community).toBe("community");
    expect(m.org).toBe("association");
    expect(m.member).toBe("member");
    expect(m.board).toBe("Board");
    expect(m.law).toBe("");
    expect(m.lawName).toBe("");
  });

  it("is total — every community type yields a complete, non-empty vocabulary", () => {
    for (const t of COMMUNITY_TYPES) {
      const terms = termsFor(t);
      for (const [key, value] of Object.entries(terms)) {
        expect(typeof value, `${t}.${key}`).toBe("string");
        // law / lawName are intentionally empty for MIXED; everything else is filled.
        if (t !== "MIXED" || (key !== "law" && key !== "lawName"))
          expect(value.length, `${t}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
