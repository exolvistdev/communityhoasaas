import type { PassThreshold, VoteChoice, VoteStatus } from "@prisma/client";

// Pure voting helpers — safe to import from client components.

export const VOTE_STATUS_BADGE: Record<
  VoteStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
  OPEN: {
    label: "Open",
    className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
};

export const VOTE_CHOICES: { value: VoteChoice; label: string }[] = [
  { value: "YES", label: "In favour" },
  { value: "NO", label: "Against" },
  { value: "ABSTAIN", label: "Abstain" },
];

export const VOTE_CHOICE_LABEL = Object.fromEntries(
  VOTE_CHOICES.map((c) => [c.value, c.label])
) as Record<VoteChoice, string>;

export const THRESHOLD_LABEL: Record<PassThreshold, string> = {
  MAJORITY: "Simple majority (more than 50% of votes cast)",
  TWO_THIRDS: "Two-thirds (at least 66.7% of votes cast)",
};

export type VoteTally = { yes: number; no: number; abstain: number; total: number };

export function voteTally(ballots: { choice: VoteChoice }[]): VoteTally {
  const t: VoteTally = { yes: 0, no: 0, abstain: 0, total: ballots.length };
  for (const b of ballots) {
    if (b.choice === "YES") t.yes++;
    else if (b.choice === "NO") t.no++;
    else t.abstain++;
  }
  return t;
}

/** Whether enough units cast a ballot for the vote to be valid. */
export function quorumMet(cast: number, eligible: number, quorumPct: number): boolean {
  if (eligible <= 0) return false;
  return (cast / eligible) * 100 >= quorumPct;
}

export type VoteOutcome = "PASSED" | "FAILED" | "NO_QUORUM";

/** Resolution outcome. Abstentions count toward quorum but not the YES/NO share. */
export function resolutionOutcome(
  tally: VoteTally,
  threshold: PassThreshold,
  quorumOK: boolean
): VoteOutcome {
  if (!quorumOK) return "NO_QUORUM";
  const decisive = tally.yes + tally.no;
  if (decisive === 0) return "FAILED";
  const share = tally.yes / decisive;
  const passes = threshold === "MAJORITY" ? share > 0.5 : share >= 2 / 3;
  return passes ? "PASSED" : "FAILED";
}

export const OUTCOME_LABEL: Record<VoteOutcome, string> = {
  PASSED: "Passed",
  FAILED: "Did not pass",
  NO_QUORUM: "No quorum",
};

/** Whether ballots can be cast right now. */
export function voteIsOpen(
  vote: { status: VoteStatus; opensAt: Date; closesAt: Date },
  now: Date = new Date()
): boolean {
  return (
    vote.status === "OPEN" &&
    vote.opensAt.getTime() <= now.getTime() &&
    now.getTime() <= vote.closesAt.getTime()
  );
}
