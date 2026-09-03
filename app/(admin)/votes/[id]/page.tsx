import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { zonedParts } from "@/lib/amenity";
import {
  VOTE_STATUS_BADGE,
  VOTE_CHOICE_LABEL,
  OUTCOME_LABEL,
  THRESHOLD_LABEL,
} from "@/lib/vote";
import { voteSummary } from "@/lib/votes";
import { VotesManager } from "../VotesManager";
import { VoteActions, RevokeProxyButton } from "./VoteActions";

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
  const v = await prisma.boardVote.findUnique({
    where: { id: params.id },
    select: { title: true },
  });
  return { title: v ? `${v.title} · HOA SaaS` : "Vote · HOA SaaS" };
}

export default async function VoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("vote:manage");

  const exists = await prisma.boardVote.findFirst({
    where: { id: params.id, orgId: org.id },
    select: { id: true },
  });
  if (!exists) notFound();

  const [{ vote, ballots, eligibleUnits, tally, quorumOK, outcome }, proxies, meetings] =
    await Promise.all([
      voteSummary(params.id),
      prisma.voteProxy.findMany({
        where: { orgId: org.id, revokedAt: null },
        include: {
          grantorProperty: { select: { unitNumber: true } },
          holderUser: { select: { fullName: true } },
        },
        orderBy: { grantedAt: "desc" },
      }),
      prisma.boardMeeting.findMany({
        where: { orgId: org.id, status: { not: "CANCELLED" } },
        select: { id: true, title: true },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      }),
    ]);

  const badge = VOTE_STATUS_BADGE[vote.status];
  const turnout =
    eligibleUnits > 0 ? Math.round((tally.total / eligibleUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link href="/votes" className="text-sm text-fg-muted hover:text-fg">
        ← Votes
      </Link>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {vote.title}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </h1>
          {vote.status === "DRAFT" && (
            <VotesManager
              meetings={meetings}
              initial={{
                id: vote.id,
                title: vote.title,
                description: vote.description,
                opensAt: dtLocal(vote.opensAt),
                closesAt: dtLocal(vote.closesAt),
                quorumPct: vote.quorumPct,
                threshold: vote.threshold,
                meetingId: vote.meetingId,
              }}
            />
          )}
        </div>
        <div className="mt-1 text-sm text-fg-muted">
          {fmt(vote.opensAt)} – {fmt(vote.closesAt)}
        </div>
        <div className="text-xs text-fg-subtle">
          Quorum {vote.quorumPct}% · {THRESHOLD_LABEL[vote.threshold]}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm text-fg">{vote.description}</p>
      </div>

      {/* tally */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Tally</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="In favour" value={tally.yes} />
          <Stat label="Against" value={tally.no} />
          <Stat label="Abstain" value={tally.abstain} />
          <Stat
            label={`Turnout (${turnout}%)`}
            value={`${tally.total} / ${eligibleUnits}`}
          />
        </div>
        <p className="mt-3 text-sm">
          <span className="text-fg-muted">
            Quorum {quorumOK ? "met" : "not met"} ·{" "}
          </span>
          <span
            className={
              outcome === "PASSED"
                ? "font-semibold text-success-fg"
                : outcome === "FAILED"
                ? "font-semibold text-danger-fg"
                : "font-semibold text-fg-muted"
            }
          >
            {vote.status === "CLOSED"
              ? OUTCOME_LABEL[outcome]
              : `Projected: ${OUTCOME_LABEL[outcome]}`}
          </span>
        </p>
      </section>

      <VoteActions
        voteId={vote.id}
        status={vote.status}
        hasResult={Boolean(vote.resultDocumentId)}
      />

      {/* ballot roster */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">
          Ballots{" "}
          <span className="text-fg-subtle">({ballots.length})</span>
        </h2>
        {ballots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No ballots cast yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {ballots.map((b) => (
                  <tr key={b.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg">{b.property.unitNumber}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {VOTE_CHOICE_LABEL[b.choice]}
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

      {/* active proxies */}
      {proxies.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Active proxies</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {proxies.map((p) => (
                  <tr key={p.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg">
                      {p.grantorProperty.unitNumber}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">
                      → {p.holderUser.fullName}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RevokeProxyButton proxyId={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="text-lg font-semibold text-fg tabular-nums">{value}</div>
    </div>
  );
}
