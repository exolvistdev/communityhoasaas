import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { ELECTION_STATUS_BADGE } from "@/lib/election";
import { orgUnitStanding } from "@/lib/good-standing";
import { quorumMet } from "@/lib/vote";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import { ElectionsManager } from "./ElectionsManager";

export const metadata = { title: "Elections · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function ElectionsPage() {
  const { org } = await requirePermission("election:manage");

  const [elections, standing, meetings] = await Promise.all([
    prisma.election.findMany({
      where: { orgId: org.id },
      include: {
        _count: { select: { ballots: true, candidates: true } },
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

  const open = elections.filter((e) => e.status === "OPEN");
  const draft = elections.filter((e) => e.status === "DRAFT");
  const past = elections.filter(
    (e) => e.status === "CLOSED" || e.status === "CANCELLED"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elections"
        description="Elect the Board of Trustees. One ballot per unit; delinquent units are suspended."
        action={<ElectionsManager meetings={meetings} />}
      />

      <Section title="Open" rows={open} eligibleUnits={eligibleUnits} fmt={fmt} />
      <Section title="Drafts" rows={draft} eligibleUnits={eligibleUnits} fmt={fmt} />
      <Section
        title="Closed & cancelled"
        rows={past}
        eligibleUnits={eligibleUnits}
        fmt={fmt}
      />

      {elections.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No elections yet.
        </p>
      )}
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  seats: number;
  opensAt: Date;
  closesAt: Date;
  quorumPct: number;
  finalizedAt: Date | null;
  _count: { ballots: number; candidates: number };
  resultDocument: { id: string } | null;
};

function Section({
  title,
  rows,
  eligibleUnits,
  fmt,
}: {
  title: string;
  rows: Row[];
  eligibleUnits: number;
  fmt: (d: Date) => string;
}) {
  if (rows.length === 0) return null;

  const columns: ResponsiveColumn<Row>[] = [
    {
      key: "election",
      header: "Election",
      card: "title",
      cardLabel: "Election",
      cell: (e) => (
        <>
          <Link
            href={`/elections/${e.id}`}
            className="font-medium text-fg hover:underline"
          >
            {e.title}
          </Link>
          <div className="text-xs text-fg-subtle">
            {fmt(e.opensAt)} – {fmt(e.closesAt)}
          </div>
        </>
      ),
    },
    {
      key: "meta",
      header: "Seats & votes",
      card: "full",
      className: "text-xs text-fg-muted",
      cell: (e) =>
        `${e.seats} seat${e.seats === 1 ? "" : "s"} · ${e._count.candidates} candidate${
          e._count.candidates === 1 ? "" : "s"
        } · ${e._count.ballots}/${eligibleUnits} cast`,
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (e) => {
        const badge = ELECTION_STATUS_BADGE[e.status];
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
      key: "progress",
      header: "Progress",
      align: "right",
      className: "text-xs",
      cell: (e) => {
        const quorumOK = quorumMet(
          e._count.ballots,
          eligibleUnits,
          e.quorumPct
        );
        const note =
          e.status === "OPEN" ? (
            <span className="text-fg-subtle">
              {quorumOK ? "Quorum met" : "No quorum yet"}
            </span>
          ) : e.status === "CLOSED" ? (
            <span className="text-fg-muted">
              {e.finalizedAt ? "Finalized" : "Awaiting finalize"}
            </span>
          ) : null;
        if (!note && !e.resultDocument) return null;
        return (
          <>
            {note}
            {e.resultDocument && (
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
        rows={rows}
        rowKey={(e) => e.id}
        columns={columns}
        hideHeader
      />
    </section>
  );
}
