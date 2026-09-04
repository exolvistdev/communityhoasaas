import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { electionSummary } from "@/lib/elections";
import { toCsvString, csvResponse } from "@/lib/csv";

const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { org } = await requirePermission("election:manage");

  const exists = await prisma.election.findFirst({
    where: { id: params.id, orgId: org.id },
    select: { id: true },
  });
  if (!exists) return new Response("Not found", { status: 404 });

  const s = await electionSummary(params.id);
  const { election, tally, candidates } = s;

  const winners = new Set(tally.winners);
  const tied = new Set(tally.tieAtCutoff);

  const rows: (string | number | null)[][] = [
    ["Election", election.title],
    ["Opens", ymd(election.opensAt)],
    ["Closes", ymd(election.closesAt)],
    ["Seats", election.seats],
    ["Eligible units", s.eligibleUnits],
    ["Ballots cast", s.cast],
    ["Turnout %", s.turnoutPct],
    ["Quorum %", election.quorumPct],
    ["Quorum met", s.quorumOK ? "yes" : "no"],
    ["Suspended units", s.suspendedUnits],
    ["Suspended candidates", s.suspendedCandidates],
    ["Outcome", s.outcome],
    [],
    ["candidate", "unit", "votes", "status"],
  ];

  for (const r of tally.rows) {
    const c = candidates.find((x) => x.id === r.candidateId);
    const status = c?.withdrawn
      ? "withdrawn"
      : c && !s.candidateEligible[c.id]
        ? "suspended — behind on dues"
        : winners.has(r.candidateId)
          ? "elected"
          : tied.has(r.candidateId)
            ? "tie for the last seat"
            : "not elected";
    rows.push([
      r.name,
      c?.homeowner?.property?.unitNumber ?? "",
      r.votes,
      status,
    ]);
  }

  return csvResponse(
    toCsvString(rows),
    `election-${org.subdomain}-${ymd(election.opensAt)}_${ymd(election.closesAt)}.csv`
  );
}
