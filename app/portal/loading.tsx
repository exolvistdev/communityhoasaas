export default function PortalLoading() {
  return (
    <div className="space-y-4">
      <div className="h-44 animate-pulse rounded-xl border border-gray-200 bg-white" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />
        <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />
      </div>
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
