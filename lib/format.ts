/** Philippine peso, thousands-separated. e.g. 1500 -> "₱1,500.00" */
export function peso(amount: number | string, opts: { cents?: boolean } = {}) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const showCents = opts.cents ?? true;
  return (
    "₱" +
    n.toLocaleString("en-PH", {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    })
  );
}

/** "2026-09" -> "September 2026" */
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

/** Compact "3m", "2h", "5d" style age; falls back to a date past a week. */
export function relativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" });
}

/** Current billing period as "YYYY-MM". */
export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
