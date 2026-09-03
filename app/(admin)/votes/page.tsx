import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  VOTE_STATUS_BADGE,
  OUTCOME_LABEL,
  quorumMet,
  resolutionOutcome,
  voteTally,
} from "@/lib/vote";
import { VotesManager } from "./VotesManager";

export const metadata = { title: "Votes · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function VotesPage() {
  const { org } = await requirePermission("vote:manage");

  const [votes, eligibleUnits, meetings] = await Promise.all([
    prisma.boardVote.findMany({
      where: { orgId: org.id },
      include: {
        ballots: { select: { choice: true } },
        resultDocument: { select: { id: true } },
      },
      orderBy: { opensAt: "desc" },
    }),
    prisma.property.count({ where: { orgId: org.id, archivedAt: null } }),
    prisma.boardMeeting.findMany({
      where: { orgId: org.id, status: { not: "CANCELLED" } },
      select: { id: true, title: true },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
  ]);

  const open = votes.filter((v) => v.status === "OPEN");
  const draft = votes.filter((v) => v.status === "DRAFT");
  const past = votes.filter((v) => v.status === "CLOSED" || v.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">Votes</h1>
          <p className="text-sm text-fg-muted">
            Put a motion to the members, track quorum, and publish the result.
          </p>
        </div>
        <VotesManager meetings={meetings} />
      </div>

      <Section title="Open" votes={open} eligibleUnits={eligibleUnits} fmt={fmt} />
      <Section title="Drafts" votes={draft} eligibleUnits={eligibleUnits} fmt={fmt} />
      <Section
        title="Closed & cancelled"
        votes={past}
        eligibleUnits={eligibleUnits}
        fmt={fmt}
      />

      {votes.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No votes yet.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  votes,
  eligibleUnits,
  fmt,
}: {
  title: string;
  votes: {
    id: string;
    title: string;
    status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
    opensAt: Date;
    closesAt: Date;
    quorumPct: number;
    threshold: "MAJORITY" | "TWO_THIRDS";
    ballots: { choice: "YES" | "NO" | "ABSTAIN" }[];
    resultDocument: { id: string } | null;
  }[];
  eligibleUnits: number;
  fmt: (d: Date) => string;
}) {
  if (votes.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {votes.map((v) => {
              const t = voteTally(v.ballots);
              const quorumOK = quorumMet(t.total, eligibleUnits, v.quorumPct);
              const outcome = resolutionOutcome(t, v.threshold, quorumOK);
              const badge = VOTE_STATUS_BADGE[v.status];
              return (
                <tr key={v.id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/votes/${v.id}`}
                      className="font-medium text-fg hover:underline"
                    >
                      {v.title}
                    </Link>
                    <div className="text-xs text-fg-subtle">
                      {fmt(v.opensAt)} – {fmt(v.closesAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {t.total}/{eligibleUnits} cast · {v.quorumPct}% quorum
                    {t.total > 0 && ` · ${t.yes} for / ${t.no} against`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {v.status === "CLOSED" ? (
                      <span className="text-fg-muted">{OUTCOME_LABEL[outcome]}</span>
                    ) : v.status === "OPEN" ? (
                      <span className="text-fg-subtle">
                        {quorumOK ? "Quorum met" : "No quorum yet"}
                      </span>
                    ) : null}
                    {v.resultDocument && (
                      <span className="ml-2 text-success-fg">Result published</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
