import { requireStaff } from "@/lib/rbac";
import { parseReportRange, homeownersReport } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { HomeownersDoc } from "@/components/reports/HomeownersDoc";

export default async function HomeownersReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await homeownersReport(org.id, range.to);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/homeowners/export?${qs}`}
      />
      <HomeownersDoc orgName={org.name} data={data} />
    </>
  );
}
