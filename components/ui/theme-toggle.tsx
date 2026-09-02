"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const OPTS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-surface p-0.5",
        className
      )}
    >
      {OPTS.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            aria-label={o.label}
            className={cn(
              "flex h-7 w-9 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-brand-subtle text-brand-accent"
                : "text-fg-subtle hover:text-fg"
            )}
          >
            <o.icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
