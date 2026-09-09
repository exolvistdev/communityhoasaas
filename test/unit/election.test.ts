import { describe, it, expect } from "vitest";
import {
  tallyElection,
  isDelinquent,
  electionIsOpen,
  trusteePositionLabel,
  trusteePositions,
} from "@/lib/election";
import { termsFor } from "@/lib/terms";

const cand = (id: string, name = id, withdrawn = false) => ({ id, name, withdrawn });
const votes = (...ids: string[]) => ids.map((candidateId) => ({ candidateId }));

describe("tallyElection", () => {
  it("seats the top N by vote count", () => {
    const r = tallyElection(
      [cand("a"), cand("b"), cand("c"), cand("d")],
      votes("a", "a", "a", "b", "b", "c"),
      2
    );
    expect(r.winners).toEqual(["a", "b"]);
    expect(r.runoffNeeded).toBe(false);
    expect(r.rows[0]).toMatchObject({ candidateId: "a", votes: 3 });
  });

  it("flags a tie for the last seat", () => {
    const r = tallyElection(
      [cand("a"), cand("b"), cand("c")],
      votes("a", "a", "b", "c"), // a=2, b=1, c=1
      2
    );
    expect(r.winners).toEqual(["a"]);
    expect(r.tieAtCutoff.sort()).toEqual(["b", "c"]);
    expect(r.runoffNeeded).toBe(true);
  });

  it("excludes withdrawn candidates from winners", () => {
    const r = tallyElection(
      [cand("a"), cand("b", "b", true), cand("c")],
      votes("a", "b", "b", "b", "c"), // b has the most but is withdrawn
      2
    );
    expect(r.winners).toEqual(["a", "c"]);
  });

  it("seats everyone when candidates <= seats", () => {
    const r = tallyElection([cand("a"), cand("b")], votes("a"), 5);
    expect(r.winners.sort()).toEqual(["a", "b"]);
    expect(r.runoffNeeded).toBe(false);
  });

  it("handles an all-abstain election (no votes)", () => {
    const r = tallyElection([cand("a"), cand("b")], [], 2);
    expect(r.winners.sort()).toEqual(["a", "b"]); // 0 == 0, but both fit the seats
    expect(r.rows.every((x) => x.votes === 0)).toBe(true);
  });

  it("without a weight key, results are identical to the old unweighted tally", () => {
    // regression guard for weighted voting
    const r = tallyElection(
      [cand("a"), cand("b"), cand("c")],
      votes("a", "a", "b", "b", "b", "c"),
      2
    );
    expect(r.winners).toEqual(["b", "a"]);
    expect(r.rows.map((x) => x.votes)).toEqual([3, 2, 1]);
  });

  it("weights each vote when a weight is given — the order can flip", () => {
    // a wins on raw count (3 vs 2) but b's voters carry more weight
    const r = tallyElection(
      [cand("a"), cand("b")],
      [
        { candidateId: "a", weight: 20 },
        { candidateId: "a", weight: 20 },
        { candidateId: "a", weight: 20 },
        { candidateId: "b", weight: 90 },
        { candidateId: "b", weight: 90 },
      ],
      1
    );
    expect(r.winners).toEqual(["b"]);
    expect(r.rows[0]).toMatchObject({ candidateId: "b", votes: 180 });
  });

  it("treats a sub-epsilon gap at the cut-off as a tie, and a real gap as a clear win", () => {
    // b = 0.3, c = 0.1 + 0.2 = 0.30000000000000004 — a floating-point hair apart
    const tieVotes = [
      { candidateId: "a", weight: 1 },
      { candidateId: "b", weight: 0.3 },
      { candidateId: "c", weight: 0.1 },
      { candidateId: "c", weight: 0.2 },
    ];
    const tied = tallyElection(
      [cand("a"), cand("b"), cand("c")],
      tieVotes,
      2 // a clearly in; b vs c fight for seat 2
    );
    expect(tied.winners).toEqual(["a"]);
    expect(tied.tieAtCutoff.sort()).toEqual(["b", "c"]);
    expect(tied.runoffNeeded).toBe(true);

    // widen c's lead past epsilon → clean result, no runoff
    const clear = tallyElection(
      [cand("a"), cand("b"), cand("c")],
      [...tieVotes, { candidateId: "c", weight: 0.5 }],
      2
    );
    expect(clear.winners).toEqual(["a", "c"]);
    expect(clear.runoffNeeded).toBe(false);
  });
});

describe("trusteePositionLabel", () => {
  it("relabels the chair for the community type, keeps the rest", () => {
    const hoa = termsFor("SUBDIVISION");
    const condo = termsFor("CONDOMINIUM");
    expect(trusteePositionLabel("CHAIRPERSON", hoa)).toBe("Chairperson");
    expect(trusteePositionLabel("CHAIRPERSON", condo)).toBe("President");
    expect(trusteePositionLabel("VICE_CHAIRPERSON", condo)).toBe("Vice-President");
    expect(trusteePositionLabel("SECRETARY", condo)).toBe("Secretary");
    expect(trusteePositionLabel("TREASURER", hoa)).toBe("Treasurer");
    expect(trusteePositionLabel("MEMBER", condo)).toBe("Member");
  });
  it("trusteePositions returns all five, relabelled", () => {
    const opts = trusteePositions(termsFor("CONDOMINIUM"));
    expect(opts).toHaveLength(5);
    expect(opts[0]).toEqual({ value: "CHAIRPERSON", label: "President" });
  });
});

describe("isDelinquent", () => {
  it("is off when the threshold is 0", () => {
    expect(isDelinquent(12, 0)).toBe(false);
  });
  it("triggers at or past the threshold", () => {
    expect(isDelinquent(2, 3)).toBe(false);
    expect(isDelinquent(3, 3)).toBe(true);
    expect(isDelinquent(4, 3)).toBe(true);
  });
});

describe("electionIsOpen", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("is open only when OPEN and inside the window", () => {
    const w = { opensAt: new Date("2026-06-01"), closesAt: new Date("2026-06-30") };
    expect(electionIsOpen({ status: "OPEN", ...w }, now)).toBe(true);
    expect(electionIsOpen({ status: "DRAFT", ...w }, now)).toBe(false);
    expect(
      electionIsOpen(
        { status: "OPEN", opensAt: new Date("2026-07-01"), closesAt: new Date("2026-07-30") },
        now
      )
    ).toBe(false);
  });
});
