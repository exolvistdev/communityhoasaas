import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

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

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/marketplace"
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← Marketplace
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-fg">
          Reported conversations
        </h1>
      </div>

      <div className="flex gap-2">
        <Pill href="/marketplace/conversations" active={!showAll}>
          Open
        </Pill>
        <Pill href="/marketplace/conversations?f=all" active={showAll}>
          All
        </Pill>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Reported by</th>
                <th className="px-4 py-2.5 font-medium">Thread</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-fg">
                    {r.reason}
                    {r.resolvedAt && (
                      <span className="ml-2 text-xs text-fg-subtle">resolved</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {r.reporter.fullName}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {r.conversation.buyer.fullName} ↔{" "}
                    {r.conversation.seller.fullName}
                    <div className="text-xs text-fg-subtle">
                      re: {r.conversation.listing.title}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {fmt(r.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/marketplace/conversations/${r.conversationId}`}
                      className="text-sm text-fg hover:underline"
                    >
                      Read thread →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-brand text-white"
          : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
