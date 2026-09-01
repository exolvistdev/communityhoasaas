export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  loading?: boolean;
}) {
  const valueTone = {
    neutral: "text-gray-900",
    success: "text-green-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <div className={`mt-1 text-2xl font-semibold ${valueTone}`}>{value}</div>
      )}
      {hint && !loading && (
        <div className="mt-1 text-xs text-gray-400">{hint}</div>
      )}
    </div>
  );
}
