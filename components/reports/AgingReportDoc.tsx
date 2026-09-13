import type { agingSnapshot } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { AgingInteractive } from "./AgingInteractive";

type Data = Awaited<ReturnType<typeof agingSnapshot>>;

export function AgingReportDoc({
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
      title="Accounts Receivable Aging"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
      headingLevel={headingLevel}
    >
      <AgingInteractive
        key={data.asOf.toISOString()}
        units={data.units}
        totals={data.totals}
        count={data.count}
        outstanding={data.outstanding}
      />
    </ReportDoc>
  );
}
