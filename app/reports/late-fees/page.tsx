import { requireStaff } from "@/lib/rbac";
import { parseReportRange, lateFeesReport } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { LateFeesDoc } from "@/components/reports/LateFeesDoc";

export default async function LateFeesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await lateFeesReport(org.id, range);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/late-fees/export?${qs}`}
      />
      <LateFeesDoc orgName={org.name} data={data} />
    </>
  );
}
