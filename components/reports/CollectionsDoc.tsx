import type { collectionsSummary, CollectionMonth } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { CollectionsInteractive } from "./CollectionsInteractive";

type Data = Awaited<ReturnType<typeof collectionsSummary>>;

export function CollectionsDoc({
  orgName,
  data,
  series = [],
  headingLevel,
}: {
  orgName: string;
  data: Data;
  series?: CollectionMonth[];
  headingLevel?: "h1" | "h2";
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Collections Summary"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
      headingLevel={headingLevel}
    >
      <CollectionsInteractive
        key={`${data.from.toISOString()}-${data.to.toISOString()}`}
        data={data}
        series={series}
      />
    </ReportDoc>
  );
}
