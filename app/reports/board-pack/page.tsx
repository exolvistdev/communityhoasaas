import { requireStaff } from "@/lib/rbac";
import {
  parseReportRange,
  boardPack,
  parseBoardPackExtras,
  BOARD_PACK_EXTRAS,
} from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { BoardPackDoc } from "@/components/reports/BoardPackDoc";

export default async function BoardPackPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; extra?: string | string[] };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const extras = parseBoardPackExtras(searchParams.extra);
  const data = await boardPack(org.id, range, extras);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar backHref="/reports" backLabel="All reports" />

      <form
        method="GET"
        className="no-print mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm"
      >
        <input type="hidden" name="from" value={range.fromYmd} />
        <input type="hidden" name="to" value={range.toYmd} />
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Include extra reports
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {BOARD_PACK_EXTRAS.map((e) => (
            <label key={e.value} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="extra"
                value={e.value}
                defaultChecked={extras.includes(e.value)}
              />
              {e.label}
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="mt-3 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Update pack
        </button>
      </form>

      <BoardPackDoc data={data} />
    </>
  );
}
