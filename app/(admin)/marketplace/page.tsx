import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  priceLabel,
} from "@/lib/marketplace";
import { PageHeader } from "@/components/PageHeader";
import { NavPill, NavPills } from "@/components/ui/nav-pill";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

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

  const columns: ResponsiveColumn<(typeof rows)[number]>[] = [
    {
      key: "listing",
      header: "Listing",
      card: "title",
      cell: (l) => (
        <>
          <Link
            href={`/marketplace/${l.id}`}
            className="font-medium text-fg hover:underline"
          >
            {l.title}
          </Link>
          <div className="text-xs text-fg-subtle">
            {CATEGORY_LABEL[l.category]}
          </div>
        </>
      ),
    },
    {
      key: "seller",
      header: "Seller",
      className: "text-fg-muted",
      cell: (l) => l.seller.fullName,
    },
    {
      key: "price",
      header: "Price",
      className: "text-fg-muted",
      cell: (l) => priceLabel(Number(l.price)),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (l) => {
        const badge = LISTING_STATUS_BADGE[l.status];
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "reports",
      header: "Reports",
      cell: (l) =>
        l._count.reports > 0 ? (
          <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-fg">
            {l._count.reports}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: "posted",
      header: "Posted",
      className: "text-fg-muted",
      cell: (l) => fmt(l.createdAt),
    },
  ];

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

      <NavPills>
        <NavPill href="/marketplace" active={filter === "all"}>
          All
        </NavPill>
        <NavPill href="/marketplace?f=reported" active={filter === "reported"}>
          Reported ({openReports})
        </NavPill>
        <NavPill href="/marketplace?f=removed" active={filter === "removed"}>
          Removed
        </NavPill>
      </NavPills>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing here.
        </p>
      ) : (
        <ResponsiveTable columns={columns} rows={rows} rowKey={(l) => l.id} />
      )}
    </div>
  );
}
