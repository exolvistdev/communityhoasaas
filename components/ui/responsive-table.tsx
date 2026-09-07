import { cn } from "@/lib/cn";

/**
 * A data table that keeps a real `<table>` from `sm:` up and renders a stacked
 * list of cards on mobile — one card per row: the `card: "title"` column as the
 * heading, the `card: "status"` column as a top-right pill, `card: "action"`
 * columns in a footer, everything else as labelled key/value pairs.
 *
 * The desktop/mobile switch is pure CSS, so this stays server-safe. Each
 * `cell` renders twice (table + card); keep them cheap and pure. When printed,
 * the table always shows and the card list is hidden, regardless of paper width.
 *
 * Genuinely tabular/financial grids (e.g. a trial balance) should NOT use this —
 * they belong on a plain `overflow-x-auto` wrapper so columns stay aligned. The
 * one exception is a document/ledger that also wants a mobile card view: pass
 * `plain` to drop the card-chrome (border box, surface fill) so it sits flush.
 */
export type ResponsiveColumn<T> = {
  /** unique within a column set; used as the React key */
  key: string;
  /** desktop `<th>` content, and the card `<dt>` label unless `cardLabel` is set */
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** extra classes for the `<th>`/`<td>` (e.g. `"tabnums whitespace-nowrap"`) */
  className?: string;
  /**
   * Role in the mobile card:
   * - `"title"`  heading, top-left (use on exactly one column)
   * - `"status"` pill slot, top-right (at most one)
   * - `"action"` footer, value only, no label
   * - `"full"`   key/value spanning both card columns
   * - `"hidden"` omitted from the card
   * - unset      normal key/value in the two-column card grid
   */
  card?: "title" | "status" | "action" | "full" | "hidden";
  /** overrides `header` as the card `<dt>` label */
  cardLabel?: React.ReactNode;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  hideHeader,
  plain,
  empty,
  className,
}: {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** extra classes for the row `<tr>` and the mobile card (e.g. mute archived) */
  rowClassName?: (row: T) => string | undefined;
  hideHeader?: boolean;
  /** drop the bordered-box / surface chrome — for a flush document/ledger */
  plain?: boolean;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty !== undefined) return <>{empty}</>;

  const titleCol = columns.find((c) => c.card === "title");
  const statusCol = columns.find((c) => c.card === "status");
  const actionCols = columns.filter((c) => c.card === "action");
  const kvCols = columns.filter(
    (c) => !c.card || c.card === "full"
  );

  return (
    <div className={className}>
      {/* desktop */}
      <div
        className={cn(
          "hidden overflow-x-auto sm:block print:block print:overflow-visible",
          !plain && "rounded-lg border border-border bg-surface"
        )}
      >
        <table className="w-full text-sm">
          {!hideHeader && (
            <thead
              className={cn("text-left text-fg-muted", !plain && "bg-surface-2")}
            >
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 font-medium",
                      col.align === "right" && "text-right",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className={cn("border-t border-border", rowClassName?.(row))}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5",
                      col.align === "right" && "text-right",
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile */}
      <div
        className={cn(
          "divide-y divide-border sm:hidden print:hidden",
          !plain && "overflow-hidden rounded-lg border border-border bg-surface"
        )}
      >
        {rows.map((row, index) => (
          <div
            key={rowKey(row, index)}
            className={cn("space-y-3 p-4", rowClassName?.(row))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-medium text-fg">
                {titleCol ? titleCol.cell(row) : null}
              </div>
              {statusCol && (
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {statusCol.cell(row)}
                </div>
              )}
            </div>

            {(() => {
              const kv = kvCols
                .map((col) => ({ col, value: col.cell(row) }))
                .filter(
                  ({ value }) =>
                    value !== null &&
                    value !== undefined &&
                    value !== false &&
                    value !== ""
                );
              if (kv.length === 0) return null;
              return (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {kv.map(({ col, value }) => (
                    <div
                      key={col.key}
                      className={col.card === "full" ? "col-span-2" : "min-w-0"}
                    >
                      <dt className="text-xs text-fg-subtle">
                        {col.cardLabel ?? col.header}
                      </dt>
                      <dd className="break-words text-sm text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            {actionCols.length > 0 && (
              <div className="flex flex-wrap gap-4 border-t border-border pt-2 text-sm">
                {actionCols.map((col) => (
                  <div key={col.key}>{col.cell(row)}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
