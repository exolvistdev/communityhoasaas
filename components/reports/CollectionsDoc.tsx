import type { collectionsSummary, CollectionMonth } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { CollectionsInteractive } from "./CollectionsInteractive";

type Data = Awaited<ReturnType<typeof collectionsSummary>>;

export function CollectionsDoc({
  orgName,
  data,
  series = [],
}: {
  orgName: string;
  data: Data;
  series?: CollectionMonth[];
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Collections Summary"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <CollectionsInteractive
        key={`${data.from.toISOString()}-${data.to.toISOString()}`}
        data={data}
        series={series}
      />
    </ReportDoc>
  );
}
