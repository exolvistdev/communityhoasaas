import { requireStaff } from "@/lib/rbac";
import { parseReportRange, agingSnapshot } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { AgingReportDoc } from "@/components/reports/AgingReportDoc";

export default async function AgingReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await agingSnapshot(org.id, range.to);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/aging/export?${qs}`}
      />
      <AgingReportDoc orgName={org.name} data={data} />
    </>
  );
}
