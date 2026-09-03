import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { parseReportRange, waterReport } from "@/lib/reports";
import { waterMetered } from "@/lib/water";
import { PrintToolbar } from "@/components/PrintToolbar";
import { WaterReportDoc } from "@/components/reports/WaterReportDoc";

export default async function WaterReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  if (!waterMetered(org.waterSource)) redirect("/dashboard");

  const range = parseReportRange(searchParams);
  const data = await waterReport(org.id, range);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/water/export?${qs}`}
      />
      <WaterReportDoc orgName={org.name} data={data} />
    </>
  );
}
