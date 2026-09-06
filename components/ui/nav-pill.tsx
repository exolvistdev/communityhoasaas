import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * A row of sub-navigation / filter pills. The row wraps to a second line when it
 * doesn't fit; each pill keeps its content width and never compresses, so
 * `rounded-full` always renders as a clean stadium (not a squished circle).
 */
export function NavPills({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
  );
}

export function NavPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-sm",
        active
          ? "bg-brand text-white"
          : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
      )}
    >
      {children}
    </Link>
  );
}
