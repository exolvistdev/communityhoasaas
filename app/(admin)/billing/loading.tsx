export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
