import { requireStaff } from "@/lib/rbac";
import { parseReportRange, violationsReport } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { ViolationsReportDoc } from "@/components/reports/ViolationsReportDoc";

export default async function ViolationsReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await violationsReport(org.id, range);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/violations/export?${qs}`}
      />
      <ViolationsReportDoc orgName={org.name} data={data} />
    </>
  );
}
