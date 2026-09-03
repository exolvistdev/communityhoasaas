import { peso } from "@/lib/format";
import type { balanceSheet } from "@/lib/ledger";
import type { CashMonth } from "@/lib/reports";
import { ReportDoc, AmountSection, fmtDate } from "./shared";
import { AssetsLiabilitiesEquityChart } from "./charts/AssetsLiabilitiesEquityChart";
import { CashTrendChart } from "./charts/CashTrendChart";

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
      <AssetsLiabilitiesEquityChart
        assets={data.assets.total}
        liabilities={data.liabilities.total}
        equity={data.equity.total}
      />
      {cash.length > 0 && <CashTrendChart data={cash} />}
      <AmountSection
        heading="Assets"
        rows={data.assets.rows}
        total={data.assets.total}
        totalLabel="Total assets"
      />
      <AmountSection
        heading="Liabilities"
        rows={data.liabilities.rows}
        total={data.liabilities.total}
        totalLabel="Total liabilities"
      />
      <AmountSection
        heading="Fund balance"
        rows={data.equity.rows}
        total={data.equity.total}
        totalLabel="Total fund balance"
      />
      <div className="mt-6 flex items-center justify-between border-t-2 border-gray-900 pt-2 text-base font-semibold">
        <span>Liabilities + fund balance</span>
        <span className="tabular-nums">
          {peso(data.liabilities.total + data.equity.total)}
        </span>
      </div>
      <p
        className={`mt-3 text-sm ${
          data.balanced ? "text-green-700" : "text-red-700"
        }`}
      >
        {data.balanced
          ? "✓ Assets equal liabilities plus fund balance."
          : "⚠ Out of balance — check the ledger."}
      </p>
    </ReportDoc>
  );
}
