import type { balanceSheet } from "@/lib/ledger";
import type { CashMonth } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { BalanceSheetInteractive } from "./BalanceSheetInteractive";

type Data = Awaited<ReturnType<typeof balanceSheet>>;

export function BalanceSheetDoc({
  orgName,
  data,
  cash = [],
}: {
  orgName: string;
  data: Data;
  cash?: CashMonth[];
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Statement of Financial Position"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
    >
      <BalanceSheetInteractive
        key={data.asOf.toISOString()}
        data={data}
        cash={cash}
      />
    </ReportDoc>
  );
}
