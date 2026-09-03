import type { agingSnapshot } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { AgingInteractive } from "./AgingInteractive";

type Data = Awaited<ReturnType<typeof agingSnapshot>>;

export function AgingReportDoc({
  orgName,
  data,
}: {
  orgName: string;
  data: Data;
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Accounts Receivable Aging"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
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
