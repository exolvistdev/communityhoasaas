export default function GuardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
      <div className="h-12 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="h-10 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="h-40 animate-pulse rounded-xl border-2 border-dashed border-border" />
    </div>
  );
}
