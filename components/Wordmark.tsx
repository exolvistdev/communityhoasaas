import { cn } from "@/lib/cn";

/** Logo lockup — a gradient glyph + label, with an optional subtitle line. */
export function Wordmark({
  className,
  label = "HOA Manager",
  subtitle,
}: {
  className?: string;
  label?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand bg-gradient-to-br from-brand-hi to-brand text-brand-fg shadow-xs">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-fg">
          {label}
        </span>
        {subtitle && (
          <span className="block truncate text-xs text-fg-subtle">
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
