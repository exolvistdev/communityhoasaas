import { requireStaff } from "@/lib/rbac";
import { parseReportRange, vendorSpendReport } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { VendorSpendDoc } from "@/components/reports/VendorSpendDoc";

export default async function VendorSpendPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await vendorSpendReport(org.id, range);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/vendor-spend/export?${qs}`}
      />
      <VendorSpendDoc orgName={org.name} data={data} />
    </>
  );
}
