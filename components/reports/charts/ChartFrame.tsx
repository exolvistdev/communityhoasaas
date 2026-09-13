"use client";

import { useEffect, useState } from "react";

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
 *
 * The chart itself only renders after mount, not during SSR. Recharts measures
 * axis-tick text width via the real DOM to lay out ticks/labels, which isn't
 * available during server rendering — it falls back to an estimate there, so
 * the server-rendered SVG and the client's first-paint SVG can disagree on
 * exact pixel positions (a real, still-open recharts SSR limitation, not
 * something fixable via component props). Deferring the chart to a
 * client-only render after hydration sidesteps the mismatch entirely: both
 * the server and the client's hydration pass render the same placeholder,
 * and the real chart swaps in afterward as a plain client update (not part
 * of hydration reconciliation). `height` reserves the placeholder's size so
 * nothing jumps when the chart appears.
 */
export function ChartFrame({
  title,
  note,
  height = 220,
  children,
}: {
  title?: string;
  note?: string;
  height?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <figure className="my-5 min-w-0 break-inside-avoid">
      {title ? (
        <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </figcaption>
      ) : null}
      {/* aria-hidden: recharts renders each Pie slice with an unlabeled
          role="img" (a library default, not something we control per-slice)
          — the figcaption above and the same data in the adjacent table
          already convey this to sighted/AT users, so the chart itself is
          decorative from an accessibility-tree standpoint. */}
      <div
        aria-hidden="true"
        className="overflow-x-auto print:overflow-visible"
      >
        {mounted ? children : <div style={{ height }} />}
      </div>
      {note ? <p className="mt-1 text-[11px] text-gray-600">{note}</p> : null}
    </figure>
  );
}
