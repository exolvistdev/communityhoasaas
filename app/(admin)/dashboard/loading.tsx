import { MetricCard } from "@/components/MetricCard";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["Total properties", "Collected", "Overdue invoices", "Active gate passes"].map(
          (label) => (
            <MetricCard key={label} label={label} value="" loading />
          )
        )}
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
