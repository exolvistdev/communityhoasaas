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
import { orgUnitStanding } from "@/lib/good-standing";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
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

  const [votes, standing, meetings] = await Promise.all([
    prisma.boardVote.findMany({
      where: { orgId: org.id },
      include: {
        ballots: { select: { choice: true, propertyId: true } },
        resultDocument: { select: { id: true } },
      },
      orderBy: { opensAt: "desc" },
    }),
    orgUnitStanding(org.id),
    prisma.boardMeeting.findMany({
      where: { orgId: org.id, status: { not: "CANCELLED" } },
      select: { id: true, title: true },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
  ]);

  const eligibleUnits = [...standing.values()].filter((s) => s.inGoodStanding).length;

  // only ballots from units in good standing count toward the inline tallies
  const counted = votes.map((v) => ({
    ...v,
    ballots: v.ballots.filter(
      (b) => standing.get(b.propertyId)?.inGoodStanding ?? false
    ),
  }));

  const open = counted.filter((v) => v.status === "OPEN");
  const draft = counted.filter((v) => v.status === "DRAFT");
  const past = counted.filter(
    (v) => v.status === "CLOSED" || v.status === "CANCELLED"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Votes"
        description="Put a motion to the members, track quorum, and publish the result."
        action={<VotesManager meetings={meetings} />}
      />

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

  const columns: ResponsiveColumn<(typeof votes)[number]>[] = [
    {
      key: "vote",
      header: "Vote",
      card: "title",
      cardLabel: "Vote",
      cell: (v) => (
        <>
          <Link
            href={`/votes/${v.id}`}
            className="font-medium text-fg hover:underline"
          >
            {v.title}
          </Link>
          <div className="text-xs text-fg-subtle">
            {fmt(v.opensAt)} – {fmt(v.closesAt)}
          </div>
        </>
      ),
    },
    {
      key: "meta",
      header: "Turnout",
      card: "full",
      className: "text-xs text-fg-muted",
      cell: (v) => {
        const t = voteTally(v.ballots);
        return `${t.total}/${eligibleUnits} cast · ${v.quorumPct}% quorum${
          t.total > 0 ? ` · ${t.yes} for / ${t.no} against` : ""
        }`;
      },
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (v) => {
        const badge = VOTE_STATUS_BADGE[v.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "result",
      header: "Result",
      align: "right",
      className: "text-xs",
      cell: (v) => {
        const t = voteTally(v.ballots);
        const quorumOK = quorumMet(t.total, eligibleUnits, v.quorumPct);
        const outcome = resolutionOutcome(t, v.threshold, quorumOK);
        const note =
          v.status === "CLOSED" ? (
            <span className="text-fg-muted">{OUTCOME_LABEL[outcome]}</span>
          ) : v.status === "OPEN" ? (
            <span className="text-fg-subtle">
              {quorumOK ? "Quorum met" : "No quorum yet"}
            </span>
          ) : null;
        if (!note && !v.resultDocument) return null;
        return (
          <>
            {note}
            {v.resultDocument && (
              <span className="ml-2 text-success-fg">Result published</span>
            )}
          </>
        );
      },
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <ResponsiveTable
        rows={votes}
        rowKey={(v) => v.id}
        columns={columns}
        hideHeader
      />
    </section>
  );
}
