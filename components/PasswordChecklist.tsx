"use client";

import { Check } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password";
import { cn } from "@/lib/cn";

/** Real-time strength checklist shown under a password field as it's typed. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met ? "text-success-fg" : "text-fg-subtle"
            )}
          >
            <span
              className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                met ? "border-success bg-success text-white" : "border-border-strong"
              )}
            >
              {met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
