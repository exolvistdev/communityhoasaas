import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

type Tone = "neutral" | "success" | "warning" | "danger";

const valueTone: Record<Tone, string> = {
  neutral: "text-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
};
const chipTone: Record<Tone, string> = {
  neutral: "bg-brand-subtle text-brand-accent",
  success: "bg-success-subtle text-success-fg",
  warning: "bg-warning-subtle text-warning-fg",
  danger: "bg-danger-subtle text-danger-fg",
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-fg-muted">{label}</div>
        {Icon && (
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              chipTone[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-surface-2" />
      ) : (
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tabnums",
            valueTone[tone]
          )}
        >
          {value}
        </div>
      )}
      {hint && !loading && (
        <div className="mt-1 text-xs text-fg-subtle">{hint}</div>
      )}
    </Card>
  );
}
