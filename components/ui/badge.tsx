import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted ring-border",
  brand: "bg-brand-subtle text-brand-accent ring-brand/20",
  success: "bg-success-subtle text-success-fg ring-success/25",
  warning: "bg-warning-subtle text-warning-fg ring-warning/25",
  danger: "bg-danger-subtle text-danger-fg ring-danger/25",
  info: "bg-info-subtle text-info-fg ring-info/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
