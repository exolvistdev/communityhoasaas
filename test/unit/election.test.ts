import { describe, it, expect } from "vitest";
import {
  tallyElection,
  isDelinquent,
  electionIsOpen,
} from "@/lib/election";

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
