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
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Marketplace
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">
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
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Nothing here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
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
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-800">
                    {r.reason}
                    {r.resolvedAt && (
                      <span className="ml-2 text-xs text-gray-400">resolved</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.reporter.fullName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.conversation.buyer.fullName} ↔{" "}
                    {r.conversation.seller.fullName}
                    <div className="text-xs text-gray-400">
                      re: {r.conversation.listing.title}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {fmt(r.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/marketplace/conversations/${r.conversationId}`}
                      className="text-sm text-gray-900 hover:underline"
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
          ? "bg-gray-900 text-white"
          : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
