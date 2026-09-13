"use client";

/**
 * Layout wrapper for a report chart: a small caption, a horizontal-scroll box
 * for narrow screens, and `break-inside-avoid` so print never splits a chart
 * across a page. The chart itself is given fixed pixel dimensions by the caller
 * (recharts `<ResponsiveContainer>` can serialize at 0×0 in the print snapshot).
 *
 * `min-w-0` matters here: report Docs place two `ChartFrame`s side by side in
 * a `flex flex-wrap` row, and flex items default to `min-width: auto` — that
 * lets a wide fixed-width chart force the whole row (and the page) wider
 * instead of wrapping to its own line / scrolling inside its own box. Without
 * it this component's own `overflow-x-auto` never gets the chance to kick in.
 */
export function ChartFrame({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-5 min-w-0 break-inside-avoid">
      {title ? (
        <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto print:overflow-visible">{children}</div>
      {note ? <p className="mt-1 text-[11px] text-gray-400">{note}</p> : null}
    </figure>
  );
}
