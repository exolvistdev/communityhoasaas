import { requireStaff } from "@/lib/rbac";
import {
  parseReportRange,
  collectionsSummary,
  eachMonth,
  monthlyCollectionSeries,
} from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { CollectionsDoc } from "@/components/reports/CollectionsDoc";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const [data, series] = await Promise.all([
    collectionsSummary(org.id, { from: range.from, to: range.to }),
    monthlyCollectionSeries(org.id, eachMonth(range)),
  ]);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/collections/export?${qs}`}
      />
      <CollectionsDoc orgName={org.name} data={data} series={series} />
    </>
  );
}
