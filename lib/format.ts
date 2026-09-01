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

/** Current billing period as "YYYY-MM". */
export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
