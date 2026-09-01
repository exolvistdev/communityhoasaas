export default function LedgerLoading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-28 animate-pulse rounded-full bg-gray-100" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
