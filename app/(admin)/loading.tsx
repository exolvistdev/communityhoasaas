/**
 * Fallback for every `(admin)/*` route that doesn't define its own
 * loading.tsx (dashboard/billing/ledger do; everything else cascades here).
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-40 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
