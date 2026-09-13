import type { payablesAging } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { PayablesInteractive } from "./PayablesInteractive";

type Data = Awaited<ReturnType<typeof payablesAging>>;

export function PayablesDoc({
  orgName,
  data,
  headingLevel,
}: {
  orgName: string;
  data: Data;
  headingLevel?: "h1" | "h2";
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Accounts Payable Aging"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
      headingLevel={headingLevel}
    >
      <PayablesInteractive
        key={data.asOf.toISOString()}
        vendors={data.vendors}
        totals={data.totals}
        count={data.count}
        outstanding={data.outstanding}
      />
    </ReportDoc>
  );
}
