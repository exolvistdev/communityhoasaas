import { requireStaff } from "@/lib/rbac";
import { balanceSheet } from "@/lib/ledger";
import { parseReportRange } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { BalanceSheetDoc } from "@/components/reports/BalanceSheetDoc";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await balanceSheet(org.id, range.to);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/balance-sheet/export?${qs}`}
      />
      <BalanceSheetDoc orgName={org.name} data={data} />
    </>
  );
}
