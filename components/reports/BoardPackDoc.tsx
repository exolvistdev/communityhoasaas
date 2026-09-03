import type { boardPack } from "@/lib/reports";
import { IncomeStatementDoc } from "./IncomeStatementDoc";
import { BalanceSheetDoc } from "./BalanceSheetDoc";
import { AgingReportDoc } from "./AgingReportDoc";
import { PayablesDoc } from "./PayablesDoc";
import { CollectionsDoc } from "./CollectionsDoc";
import { LateFeesDoc } from "./LateFeesDoc";
import { VendorSpendDoc } from "./VendorSpendDoc";
import { ViolationsReportDoc } from "./ViolationsReportDoc";
import { HomeownersDoc } from "./HomeownersDoc";
import { fmtDate } from "./shared";

type Data = Awaited<ReturnType<typeof boardPack>>;

const CATEGORY_LABEL: Record<string, string> = {
  FINANCIAL_STATEMENT: "Financial statement",
  BOARD_MINUTES: "Board minutes",
};

export function BoardPackDoc({ data }: { data: Data }) {
  const { org, range } = data;
  const period = `${fmtDate(range.from)} – ${fmtDate(range.to)}`;

  const sections: { key: string; toc: string; node: React.ReactNode }[] = [
    {
      key: "income",
      toc: "Statement of Income & Expenses",
      node: (
        <IncomeStatementDoc
          orgName={org.name}
          data={data.income}
          series={data.ledgerSeries}
        />
      ),
    },
    {
      key: "balance",
      toc: "Statement of Financial Position",
      node: <BalanceSheetDoc orgName={org.name} data={data.balance} cash={data.cash} />,
    },
    {
      key: "aging",
      toc: "Accounts Receivable Aging",
      node: <AgingReportDoc orgName={org.name} data={data.aging} />,
    },
    {
      key: "payables",
      toc: "Accounts Payable Aging",
      node: <PayablesDoc orgName={org.name} data={data.payables} />,
    },
    {
      key: "collections",
      toc: "Collections Summary",
      node: (
        <CollectionsDoc
          orgName={org.name}
          data={data.collections}
          series={data.collectionSeries}
        />
      ),
    },
  ];

  if (data.lateFees)
    sections.push({
      key: "late-fees",
      toc: "Late Fees",
      node: <LateFeesDoc orgName={org.name} data={data.lateFees} />,
    });
  if (data.vendorSpend)
    sections.push({
      key: "vendor-spend",
      toc: "Vendor Spend",
      node: <VendorSpendDoc orgName={org.name} data={data.vendorSpend} />,
    });
  if (data.violations)
    sections.push({
      key: "violations",
      toc: "Violations & Fines",
      node: <ViolationsReportDoc orgName={org.name} data={data.violations} />,
    });
  if (data.homeowners)
    sections.push({
      key: "homeowners",
      toc: "Homeowners",
      node: <HomeownersDoc orgName={org.name} data={data.homeowners} />,
    });

  if (data.documents.length > 0)
    sections.push({
      key: "documents",
      toc: "Supporting documents",
      node: (
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
                <span className="text-xs text-gray-400">{fmtDate(d.createdAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-400">
            Full files are in the HOA document library.
          </p>
        </article>
      ),
    });

  return (
    <div className="space-y-10">
      {/* cover */}
      <article className="break-after-page bg-white p-8 text-gray-900 print:p-0">
        <div className="text-lg font-semibold">{org.name}</div>
        <div className="mt-1 text-gray-500">Board Financial Pack</div>
        <div className="mt-8 text-2xl font-semibold">{period}</div>
        <p className="mt-8 max-w-md text-sm text-gray-500">
          Prepared {fmtDate(new Date())}. Financial statements and analysis for
          the period, for review at the board meeting.
        </p>
        <ol className="mt-8 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          {sections.map((s) => (
            <li key={s.key}>{s.toc}</li>
          ))}
        </ol>
      </article>

      {sections.map((s, i) => (
        <div
          key={s.key}
          className={i < sections.length - 1 ? "break-after-page" : ""}
        >
          {s.node}
        </div>
      ))}
    </div>
  );
}
