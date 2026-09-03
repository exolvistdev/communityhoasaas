import { requireStaff } from "@/lib/rbac";
import { parseReportRange, payablesAging } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { PayablesDoc } from "@/components/reports/PayablesDoc";

export default async function PayablesReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await payablesAging(org.id, range.to);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/payables/export?${qs}`}
      />
      <PayablesDoc orgName={org.name} data={data} />
    </>
  );
}
