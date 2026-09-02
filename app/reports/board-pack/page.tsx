import { requireStaff } from "@/lib/rbac";
import { parseReportRange, boardPack } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { BoardPackDoc } from "@/components/reports/BoardPackDoc";

export default async function BoardPackPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const data = await boardPack(org.id, range);

  return (
    <>
      <PrintToolbar backHref="/reports" backLabel="All reports" />
      <BoardPackDoc data={data} />
    </>
  );
}
