import type { balanceSheet } from "@/lib/ledger";
import type { CashMonth } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { BalanceSheetInteractive } from "./BalanceSheetInteractive";

type Data = Awaited<ReturnType<typeof balanceSheet>>;

export function BalanceSheetDoc({
  orgName,
  data,
  cash = [],
  headingLevel,
}: {
  orgName: string;
  data: Data;
  cash?: CashMonth[];
  headingLevel?: "h1" | "h2";
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Statement of Financial Position"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
      headingLevel={headingLevel}
    >
      <BalanceSheetInteractive
        key={data.asOf.toISOString()}
        data={data}
        cash={cash}
      />
    </ReportDoc>
  );
}
