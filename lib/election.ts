import type { ElectionStatus, TrusteePosition } from "@prisma/client";
import type { Terms } from "@/lib/terms";

// Pure election helpers — safe to import from client components.

export const ELECTION_STATUS_BADGE: Record<
  ElectionStatus,
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

export const TRUSTEE_POSITIONS: { value: TrusteePosition; label: string }[] = [
  { value: "CHAIRPERSON", label: "Chairperson" },
  { value: "VICE_CHAIRPERSON", label: "Vice-Chairperson" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "MEMBER", label: "Member" },
];

export const TRUSTEE_POSITION_LABEL = Object.fromEntries(
  TRUSTEE_POSITIONS.map((p) => [p.value, p.label])
) as Record<TrusteePosition, string>;

/** Position label for the org's community type — "Chairperson" for an HOA,
 *  "President" for a condominium; the rest are the same everywhere. */
export function trusteePositionLabel(
  pos: TrusteePosition,
  terms: Terms
): string {
  if (pos === "CHAIRPERSON") return terms.chairTitle;
  if (pos === "VICE_CHAIRPERSON") return terms.viceChairTitle;
  return TRUSTEE_POSITION_LABEL[pos];
}

/** The position options, relabelled for the org's community type. */
export function trusteePositions(
  terms: Terms
): { value: TrusteePosition; label: string }[] {
  return TRUSTEE_POSITIONS.map((p) => ({
    value: p.value,
    label: trusteePositionLabel(p.value, terms),
  }));
}

/** Officer positions that at most one active trustee may hold. */
export const OFFICER_POSITIONS: TrusteePosition[] = [
  "CHAIRPERSON",
  "VICE_CHAIRPERSON",
  "SECRETARY",
  "TREASURER",
];

/** Whether ballots can be cast right now. */
export function electionIsOpen(
  election: { status: ElectionStatus; opensAt: Date; closesAt: Date },
  now: Date = new Date()
): boolean {
  return (
    election.status === "OPEN" &&
    election.opensAt.getTime() <= now.getTime() &&
    now.getTime() <= election.closesAt.getTime()
  );
}

/** RA 9904 delinquency gate. 0 threshold disables the rule. */
export function isDelinquent(monthsBehind: number, thresholdMonths: number): boolean {
  return thresholdMonths > 0 && monthsBehind >= thresholdMonths;
}

export type ElectionTallyRow = {
  candidateId: string;
  name: string;
  votes: number;
  withdrawn: boolean;
};

export type ElectionTally = {
  rows: ElectionTallyRow[]; // by votes desc, then name
  winners: string[]; // candidateIds — top `seats`, unambiguous only
  tieAtCutoff: string[]; // candidateIds tied on the vote count of the last seat
  runoffNeeded: boolean;
};

const EPS = 1e-6;

/**
 * "Vote for up to N" tally: the `seats` candidates with the most approvals win.
 * A tie on the vote count of the last available seat can't be resolved
 * automatically — those candidates are returned in `tieAtCutoff` and `winners`
 * holds only the ones safely above the tie.
 *
 * Each vote counts as `weight` (its unit's voting weight) — omit `weight` and
 * every vote counts as 1 (one-unit-one-vote). Comparisons use an epsilon so
 * fractional weights don't create phantom ties.
 */
export function tallyElection(
  candidates: { id: string; name: string; withdrawn: boolean }[],
  votes: { candidateId: string; weight?: number }[],
  seats: number
): ElectionTally {
  const count = new Map<string, number>();
  for (const v of votes)
    count.set(v.candidateId, (count.get(v.candidateId) ?? 0) + (v.weight ?? 1));

  const rows: ElectionTallyRow[] = candidates
    .map((c) => ({
      candidateId: c.id,
      name: c.name,
      votes: count.get(c.id) ?? 0,
      withdrawn: c.withdrawn,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  const contenders = rows.filter((r) => !r.withdrawn);
  const n = Math.max(0, Math.min(seats, contenders.length));

  if (n === 0)
    return { rows, winners: [], tieAtCutoff: [], runoffNeeded: false };

  const cutoffVotes = contenders[n - 1].votes;
  const nextVotes = contenders[n]?.votes ?? -1;

  // clear win: everyone at rank < n whose count is strictly above the cutoff,
  // plus the cutoff group only if it doesn't overflow the remaining seats
  if (Math.abs(cutoffVotes - nextVotes) > EPS) {
    return {
      rows,
      winners: contenders.slice(0, n).map((r) => r.candidateId),
      tieAtCutoff: [],
      runoffNeeded: false,
    };
  }

  const aboveCutoff = contenders.filter((r) => r.votes > cutoffVotes + EPS);
  const atCutoff = contenders.filter(
    (r) => Math.abs(r.votes - cutoffVotes) <= EPS
  );
  return {
    rows,
    winners: aboveCutoff.map((r) => r.candidateId),
    tieAtCutoff: atCutoff.map((r) => r.candidateId),
    runoffNeeded: true,
  };
}
