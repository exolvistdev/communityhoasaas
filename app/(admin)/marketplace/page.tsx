import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  priceLabel,
} from "@/lib/marketplace";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        title="Marketplace"
        action={
          <Link
            href="/marketplace/conversations"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2"
          >
            Reported conversations
            {openConvoReports > 0 && (
              <span className="ml-1.5 rounded-full bg-danger-subtle px-1.5 text-xs font-medium text-danger-fg">
                {openConvoReports}
              </span>
            )}
          </Link>
        }
      />

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
        <p className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
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
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/marketplace/${l.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        {l.title}
                      </Link>
                      <div className="text-xs text-fg-subtle">
                        {CATEGORY_LABEL[l.category]}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {l.seller.fullName}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
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
                        <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-fg">
                          {l._count.reports}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
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
          ? "bg-brand text-white"
          : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
