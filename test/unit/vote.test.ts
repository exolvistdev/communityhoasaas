import { describe, it, expect } from "vitest";
import {
  voteTally,
  quorumMet,
  resolutionOutcome,
  voteIsOpen,
  VOTE_CHOICE_LABEL,
} from "@/lib/vote";
import type { VoteChoice } from "@prisma/client";

const ballots = (...cs: VoteChoice[]) => cs.map((choice) => ({ choice }));

describe("voteTally", () => {
  it("counts by choice", () => {
    expect(voteTally(ballots("YES", "YES", "NO", "ABSTAIN"))).toEqual({
      yes: 2,
      no: 1,
      abstain: 1,
      total: 4,
    });
  });
  it("is all zeros for no ballots", () => {
    expect(voteTally([])).toEqual({ yes: 0, no: 0, abstain: 0, total: 0 });
  });
});

describe("quorumMet", () => {
  it("is false with no eligible units", () => {
    expect(quorumMet(0, 0, 50)).toBe(false);
  });
  it("compares cast/eligible against the percent (inclusive at the boundary)", () => {
    expect(quorumMet(4, 10, 40)).toBe(true); // exactly 40%
    expect(quorumMet(3, 10, 40)).toBe(false); // 30%
    expect(quorumMet(10, 10, 100)).toBe(true);
  });
});

describe("resolutionOutcome", () => {
  const T = (yes: number, no: number, abstain = 0) => ({
    yes,
    no,
    abstain,
    total: yes + no + abstain,
  });

  it("is NO_QUORUM when quorum is not met, regardless of the split", () => {
    expect(resolutionOutcome(T(9, 0), "MAJORITY", false)).toBe("NO_QUORUM");
  });
  it("MAJORITY needs strictly more than half of yes+no", () => {
    expect(resolutionOutcome(T(3, 3), "MAJORITY", true)).toBe("FAILED"); // exactly 50%
    expect(resolutionOutcome(T(4, 3), "MAJORITY", true)).toBe("PASSED");
  });
  it("TWO_THIRDS is inclusive at two-thirds", () => {
    expect(resolutionOutcome(T(2, 1), "TWO_THIRDS", true)).toBe("PASSED"); // exactly 2/3
    expect(resolutionOutcome(T(3, 2), "TWO_THIRDS", true)).toBe("FAILED"); // 60%
  });
  it("abstentions don't count toward the yes/no share but an all-abstain vote fails", () => {
    expect(resolutionOutcome(T(0, 0, 5), "MAJORITY", true)).toBe("FAILED");
    expect(resolutionOutcome(T(2, 1, 5), "MAJORITY", true)).toBe("PASSED");
  });
});

describe("voteIsOpen", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const win = (status: any, from: string, to: string) => ({
    status,
    opensAt: new Date(from),
    closesAt: new Date(to),
  });

  it("is open only when status is OPEN and now is inside the window", () => {
    expect(voteIsOpen(win("OPEN", "2026-09-10T00:00:00Z", "2026-09-20T00:00:00Z"), now)).toBe(true);
    expect(voteIsOpen(win("DRAFT", "2026-09-10T00:00:00Z", "2026-09-20T00:00:00Z"), now)).toBe(false);
    expect(voteIsOpen(win("OPEN", "2026-09-16T00:00:00Z", "2026-09-20T00:00:00Z"), now)).toBe(false);
    expect(voteIsOpen(win("OPEN", "2026-09-01T00:00:00Z", "2026-09-10T00:00:00Z"), now)).toBe(false);
  });
});

describe("VOTE_CHOICE_LABEL", () => {
  it("maps each choice", () => {
    expect(VOTE_CHOICE_LABEL.YES).toBe("In favour");
    expect(VOTE_CHOICE_LABEL.NO).toBe("Against");
    expect(VOTE_CHOICE_LABEL.ABSTAIN).toBe("Abstain");
  });
});
