import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/PageHeader";
import { NavPill, NavPills } from "@/components/ui/nav-pill";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export const metadata = { title: "Reported conversations · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function ReportedConversationsPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  const { org } = await requirePermission("marketplace:moderate");
  const showAll = searchParams.f === "all";

  const reports = await prisma.conversationReport.findMany({
    where: {
      conversation: { orgId: org.id },
      ...(showAll ? {} : { resolvedAt: null }),
    },
    orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    include: {
      reporter: { select: { fullName: true } },
      conversation: {
        include: {
          listing: { select: { title: true } },
          buyer: { select: { fullName: true } },
          seller: { select: { fullName: true } },
        },
      },
    },
  });

  const columns: ResponsiveColumn<(typeof reports)[number]>[] = [
    {
      key: "reason",
      header: "Reason",
      card: "full",
      className: "text-fg",
      cell: (r) => (
        <>
          {r.reason}
          {r.resolvedAt && (
            <span className="ml-2 text-xs text-fg-subtle">resolved</span>
          )}
        </>
      ),
    },
    {
      key: "reportedBy",
      header: "Reported by",
      className: "text-fg-muted",
      cell: (r) => r.reporter.fullName,
    },
    {
      key: "thread",
      header: "Thread",
      card: "title",
      className: "text-fg-muted",
      cell: (r) => (
        <>
          {r.conversation.buyer.fullName} ↔ {r.conversation.seller.fullName}
          <div className="text-xs text-fg-subtle">
            re: {r.conversation.listing.title}
          </div>
        </>
      ),
    },
    {
      key: "when",
      header: "When",
      className: "text-fg-muted",
      cell: (r) => fmt(r.createdAt),
    },
    {
      key: "read",
      header: "",
      align: "right",
      card: "action",
      cell: (r) => (
        <Link
          href={`/marketplace/conversations/${r.conversationId}`}
          className="text-sm text-fg hover:underline"
        >
          Read thread →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reported conversations"
        backLink={{ href: "/marketplace", label: "Marketplace" }}
      />

      <NavPills>
        <NavPill href="/marketplace/conversations" active={!showAll}>
          Open
        </NavPill>
        <NavPill href="/marketplace/conversations?f=all" active={showAll}>
          All
        </NavPill>
      </NavPills>

      {reports.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing here.
        </p>
      ) : (
        <ResponsiveTable columns={columns} rows={reports} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
