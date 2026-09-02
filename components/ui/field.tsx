import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-ring/40 disabled:opacity-60";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input ref={ref} className={cn(controlBase, "h-9", className)} {...rest} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlBase, "h-9 appearance-none pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlBase, "py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5 text-sm", className)}>
      {label && <span className="block font-medium text-fg">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-fg-subtle">{hint}</span>}
      {error && <FormError>{error}</FormError>}
    </label>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-danger-fg">{children}</p>;
}
