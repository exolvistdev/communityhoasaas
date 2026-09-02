import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Small-caps label above a section, with an optional right-aligned action. */
export function SectionHeader({
  label,
  action,
  className,
}: {
  label: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </h2>
      {action}
    </div>
  );
}
