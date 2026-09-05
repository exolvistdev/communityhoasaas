import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { zonedParts } from "@/lib/amenity";
import {
  ELECTION_STATUS_BADGE,
  type ElectionTallyRow,
} from "@/lib/election";
import { electionSummary } from "@/lib/elections";
import { orgUnitStanding } from "@/lib/good-standing";
import { ElectionsManager } from "../ElectionsManager";
import { CandidateManager } from "./CandidateManager";
import { ElectionActions } from "./ElectionActions";

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const pad = (n: number) => String(n).padStart(2, "0");
const dtLocal = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

export async function generateMetadata({ params }: { params: { id: string } }) {
  const e = await prisma.election.findUnique({
    where: { id: params.id },
    select: { title: true },
  });
  return { title: e ? `${e.title} · HOA SaaS` : "Election · HOA SaaS" };
}

export default async function ElectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("election:manage");

  const exists = await prisma.election.findFirst({
    where: { id: params.id, orgId: org.id },
    select: { id: true },
  });
  if (!exists) notFound();

  const [summary, standing, meetings, homeowners] = await Promise.all([
    electionSummary(params.id),
    orgUnitStanding(org.id),
    prisma.boardMeeting.findMany({
      where: { orgId: org.id, status: { not: "CANCELLED" } },
      select: { id: true, title: true },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
    prisma.homeowner.findMany({
      where: {
        property: { orgId: org.id, archivedAt: null },
        isPrimary: true,
      },
      select: {
        id: true,
        fullName: true,
        property: { select: { id: true, unitNumber: true } },
      },
      orderBy: { property: { unitNumber: "asc" } },
    }),
  ]);

  const {
    election,
    candidates,
    ballots,
    tally,
    candidateEligible,
    eligibleUnits,
    suspendedUnits,
    cast,
    quorumOK,
    turnoutPct,
    outcome,
  } = summary;
  const badge = ELECTION_STATUS_BADGE[election.status];

  const takenHomeownerIds = new Set(
    candidates.map((c) => c.homeownerId).filter(Boolean) as string[]
  );
  const candidatePool = homeowners
    .filter((h) => !takenHomeownerIds.has(h.id))
    .map((h) => ({
      id: h.id,
      label: `${h.fullName} · ${h.property.unitNumber}`,
      suspended: !(standing.get(h.property.id)?.inGoodStanding ?? true),
    }));

  // candidates whose own unit isn't in good standing (and who haven't withdrawn)
  const ineligibleIds = new Set(
    candidates
      .filter((c) => !c.withdrawn && !candidateEligible[c.id])
      .map((c) => c.id)
  );
  const suspendedCandidates = candidates.filter((c) => ineligibleIds.has(c.id));

  return (
    <div className="space-y-6">
      <Link href="/elections" className="text-sm text-fg-muted hover:text-fg">
        ← Elections
      </Link>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {election.title}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </h1>
          {election.status === "DRAFT" && (
            <ElectionsManager
              meetings={meetings}
              initial={{
                id: election.id,
                title: election.title,
                description: election.description,
                seats: election.seats,
                opensAt: dtLocal(election.opensAt),
                closesAt: dtLocal(election.closesAt),
                quorumPct: election.quorumPct,
                termMonths: election.termMonths,
                meetingId: election.meetingId,
              }}
            />
          )}
        </div>
        <div className="mt-1 text-sm text-fg-muted">
          {fmt(election.opensAt)} – {fmt(election.closesAt)}
        </div>
        <div className="text-xs text-fg-subtle">
          {election.seats} seat{election.seats === 1 ? "" : "s"} · {election.termMonths}
          -month term · Quorum {election.quorumPct}%
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-fg">
          {election.description}
        </p>
      </div>

      <CandidateManager
        electionId={election.id}
        status={election.status}
        candidates={candidates.map((c) => ({
          id: c.id,
          name: c.name,
          bio: c.bio,
          withdrawn: c.withdrawn,
          ineligible: ineligibleIds.has(c.id),
          votes: tally.rows.find((r) => r.candidateId === c.id)?.votes ?? 0,
        }))}
        pool={candidatePool}
      />

      {suspendedCandidates.length > 0 && (
        <p className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
          {suspendedCandidates.map((c) => c.name).join(", ")} —{" "}
          {suspendedCandidates.length === 1 ? "this unit is" : "these units are"}{" "}
          behind on dues and can&apos;t be elected. Their votes aren&apos;t counted
          toward a seat; the next candidate takes it.
        </p>
      )}

      {/* tally */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">
            {election.status === "CLOSED" ? "Result" : "Live tally"}
          </h2>
          <div className="flex items-center gap-3 text-xs text-fg-subtle">
            <span>
              {cast}/{eligibleUnits} units cast · {turnoutPct}% turnout
              {suspendedUnits > 0 && ` · ${suspendedUnits} suspended`}
            </span>
            <a
              href={`/elections/${election.id}/export`}
              className="text-brand-accent hover:underline"
            >
              Download tally (CSV)
            </a>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5">
          {tally.rows.map((r, i) => (
            <TallyBar
              key={r.candidateId}
              row={r}
              max={tally.rows[0]?.votes ?? 1}
              winner={tally.winners.includes(r.candidateId)}
              tied={tally.tieAtCutoff.includes(r.candidateId)}
              ineligible={ineligibleIds.has(r.candidateId)}
              rank={i + 1}
              seats={election.seats}
            />
          ))}
          {tally.rows.length === 0 && (
            <li className="text-sm text-fg-muted">No candidates.</li>
          )}
        </ul>

        {election.finalizedAt && (
          <p className="mt-3 text-sm">
            <a href="/board" className="text-brand-accent hover:underline">
              Winners seated on the board →
            </a>
          </p>
        )}

        <p className="mt-3 text-sm">
          <span className="text-fg-muted">
            Quorum {quorumOK ? "met" : "not met"} ·{" "}
          </span>
          <span
            className={
              outcome === "ELECTED"
                ? "font-semibold text-success-fg"
                : outcome === "RUNOFF"
                ? "font-semibold text-warning-fg"
                : "font-semibold text-fg-muted"
            }
          >
            {election.status === "CLOSED"
              ? outcome === "ELECTED"
                ? "Winners determined"
                : outcome === "RUNOFF"
                ? "Tie for the last seat — needs a runoff"
                : "No quorum — invalid"
              : `Projected: ${
                  outcome === "ELECTED"
                    ? "winners clear"
                    : outcome === "RUNOFF"
                    ? "tie at the cut-off"
                    : "no quorum"
                }`}
          </span>
        </p>
      </section>

      <ElectionActions
        electionId={election.id}
        status={election.status}
        finalized={Boolean(election.finalizedAt)}
        canFinalize={
          election.status === "CLOSED" &&
          !election.finalizedAt &&
          quorumOK &&
          !tally.runoffNeeded &&
          tally.winners.length > 0
        }
        hasResult={Boolean(election.resultDocumentId)}
      />

      {/* ballot roster */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">
          Ballots <span className="text-fg-subtle">({ballots.length})</span>
        </h2>
        {ballots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No ballots cast yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {ballots.map((b) => (
                  <tr key={b.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg">{b.property.unitNumber}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {b.abstain
                        ? "Abstained"
                        : `${b.votes.length} pick${
                            b.votes.length === 1 ? "" : "s"
                          }`}
                    </td>
                    <td className="px-4 py-2 text-xs text-fg-subtle">
                      {b.castBy?.fullName ?? "—"}
                      {b.viaProxy ? " · via proxy" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TallyBar({
  row,
  max,
  winner,
  tied,
  ineligible,
  rank,
  seats,
}: {
  row: ElectionTallyRow;
  max: number;
  winner: boolean;
  tied: boolean;
  ineligible: boolean;
  rank: number;
  seats: number;
}) {
  const pct = max > 0 ? Math.round((row.votes / max) * 100) : 0;
  return (
    <li>
      <div className="flex items-center justify-between text-sm">
        <span className={row.withdrawn ? "text-fg-subtle line-through" : "text-fg"}>
          {row.name}
          {ineligible && (
            <span className="ml-2 text-xs font-medium text-warning-fg no-underline">
              behind on dues
            </span>
          )}
          {winner && (
            <span className="ml-2 text-xs font-medium text-success-fg">✓ seat</span>
          )}
          {tied && (
            <span className="ml-2 text-xs font-medium text-warning-fg">tie</span>
          )}
          {rank === seats && !winner && !tied && !ineligible && (
            <span className="ml-2 text-xs text-fg-subtle">cut-off</span>
          )}
        </span>
        <span className="tabular-nums text-fg-muted">{row.votes}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${
            winner ? "bg-success" : tied ? "bg-warning" : "bg-brand"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
