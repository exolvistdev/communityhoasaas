export default function PortalLoading() {
  return (
    <div className="space-y-4">
      <div className="h-44 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-xl border border-border bg-surface" />
        <div className="h-20 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
