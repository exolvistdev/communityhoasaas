export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-gray-200 bg-white"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
