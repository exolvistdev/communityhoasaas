/**
 * Fixed light-mode chart palette. The report `*Doc` frames render on a white
 * `<article>` even in dark mode, and print-to-PDF forces a white ground — so
 * charts always draw with these values rather than reading the CSS token layer.
 * Hexes mirror the `--brand / --success / --warning / --danger / --info` tokens
 * in `app/globals.css` (light `:root`).
 */
export const CHART = {
  brand: "#4F46E5",
  brandHi: "#6366F1",
  success: "#059669",
  warning: "#D97706",
  danger: "#E11D48",
  info: "#0284C7",
  grid: "#E4E4E9",
  axis: "#525866",
  muted: "#8D94A3",
} as const;

/** Categorical colour cycle for donuts / multi-series charts. */
export const CHART_SERIES = [
  CHART.brand,
  CHART.info,
  CHART.warning,
  CHART.success,
  CHART.danger,
  CHART.brandHi,
  CHART.muted,
] as const;

/** Compact peso for axis ticks: 12500 -> "₱13k", 2_400_000 -> "₱2.4M". */
export function compactPeso(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${Math.round(n / 1_000)}k`;
  return `₱${Math.round(n)}`;
}
