/** Fallback for every `reports/*` route — none of them define their own. */
export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 animate-pulse rounded bg-surface-2" />
      <div className="h-10 w-full max-w-md animate-pulse rounded-lg border border-border bg-surface" />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
