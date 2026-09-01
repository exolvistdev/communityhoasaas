import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  priceLabel,
} from "@/lib/marketplace";

export const metadata = { title: "Marketplace · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

type Filter = "all" | "reported" | "removed";

export default async function AdminMarketplacePage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  const { org } = await requirePermission("marketplace:moderate");
  const filter: Filter =
    searchParams.f === "reported"
      ? "reported"
      : searchParams.f === "removed"
      ? "removed"
      : "all";

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      orgId: org.id,
      ...(filter === "removed" ? { status: "REMOVED" } : {}),
      ...(filter === "reported"
        ? { reports: { some: { resolvedAt: null } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { fullName: true } },
      _count: { select: { reports: { where: { resolvedAt: null } } } },
    },
  });

  // Unresolved-reported listings float to the top of the "all" view.
  const rows =
    filter === "all"
      ? [...listings].sort(
          (a, b) =>
            (b._count.reports > 0 ? 1 : 0) - (a._count.reports > 0 ? 1 : 0)
        )
      : listings;

  const [openReports, openConvoReports] = await Promise.all([
    prisma.marketplaceListing.count({
      where: { orgId: org.id, reports: { some: { resolvedAt: null } } },
    }),
    prisma.conversationReport.count({
      where: { resolvedAt: null, conversation: { orgId: org.id } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Marketplace</h1>
        <Link
          href="/marketplace/conversations"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Reported conversations
          {openConvoReports > 0 && (
            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-800">
              {openConvoReports}
            </span>
          )}
        </Link>
      </div>

      <div className="flex gap-2">
        <Pill href="/marketplace" active={filter === "all"}>
          All
        </Pill>
        <Pill href="/marketplace?f=reported" active={filter === "reported"}>
          Reported ({openReports})
        </Pill>
        <Pill href="/marketplace?f=removed" active={filter === "removed"}>
          Removed
        </Pill>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Nothing here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Listing</th>
                <th className="px-4 py-2.5 font-medium">Seller</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Reports</th>
                <th className="px-4 py-2.5 font-medium">Posted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const badge = LISTING_STATUS_BADGE[l.status];
                return (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/marketplace/${l.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {l.title}
                      </Link>
                      <div className="text-xs text-gray-400">
                        {CATEGORY_LABEL[l.category]}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {l.seller.fullName}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {priceLabel(Number(l.price))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {l._count.reports > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          {l._count.reports}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {fmt(l.createdAt)}
                    </td>
                  </tr>
                );
              })}
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
