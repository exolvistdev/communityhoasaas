import type { boardPack } from "@/lib/reports";
import { IncomeStatementDoc } from "./IncomeStatementDoc";
import { BalanceSheetDoc } from "./BalanceSheetDoc";
import { AgingReportDoc } from "./AgingReportDoc";
import { PayablesDoc } from "./PayablesDoc";
import { CollectionsDoc } from "./CollectionsDoc";
import { fmtDate } from "./shared";

type Data = Awaited<ReturnType<typeof boardPack>>;

const CATEGORY_LABEL: Record<string, string> = {
  FINANCIAL_STATEMENT: "Financial statement",
  BOARD_MINUTES: "Board minutes",
};

export function BoardPackDoc({ data }: { data: Data }) {
  const { org, range } = data;
  const period = `${fmtDate(range.from)} – ${fmtDate(range.to)}`;

  return (
    <div className="space-y-10">
      {/* cover */}
      <article className="break-after-page bg-white p-8 text-gray-900 print:p-0">
        <div className="text-lg font-semibold">{org.name}</div>
        <div className="mt-1 text-gray-500">Board Financial Pack</div>
        <div className="mt-8 text-2xl font-semibold">{period}</div>
        <p className="mt-8 max-w-md text-sm text-gray-500">
          Prepared {fmtDate(new Date())}. Contains the statement of income &amp;
          expenses, statement of financial position, receivables aging and a
          collections summary for the period.
        </p>
        <ol className="mt-8 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Statement of Income &amp; Expenses</li>
          <li>Statement of Financial Position</li>
          <li>Accounts Receivable Aging</li>
          <li>Accounts Payable Aging</li>
          <li>Collections Summary</li>
          {data.documents.length > 0 && <li>Supporting documents</li>}
        </ol>
      </article>

      <div className="break-after-page">
        <IncomeStatementDoc
          orgName={org.name}
          data={data.income}
          series={data.ledgerSeries}
        />
      </div>
      <div className="break-after-page">
        <BalanceSheetDoc orgName={org.name} data={data.balance} cash={data.cash} />
      </div>
      <div className="break-after-page">
        <AgingReportDoc orgName={org.name} data={data.aging} />
      </div>
      <div className="break-after-page">
        <PayablesDoc orgName={org.name} data={data.payables} />
      </div>
      <div className={data.documents.length > 0 ? "break-after-page" : ""}>
        <CollectionsDoc
          orgName={org.name}
          data={data.collections}
          series={data.collectionSeries}
        />
      </div>

      {data.documents.length > 0 && (
        <article className="bg-white p-8 text-sm text-gray-900 print:p-0">
          <header className="border-b border-gray-300 pb-4 text-base font-semibold">
            Supporting documents
          </header>
          <ul className="mt-4 space-y-2">
            {data.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>
                  {d.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {CATEGORY_LABEL[d.category] ?? d.category}
                  </span>
                </span>
                <span className="text-xs text-gray-400">
                  {fmtDate(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-400">
            Full files are in the HOA document library.
          </p>
        </article>
      )}
    </div>
  );
}
