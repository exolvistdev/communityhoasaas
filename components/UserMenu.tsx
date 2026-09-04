"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound, Home } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  name,
  role,
  accountHref = "/account",
  residentHref,
  openUp = false,
  align = "right",
}: {
  name: string;
  role: string;
  accountHref?: string;
  /** Set when this staff member also owns a unit — links to the resident portal. */
  residentHref?: string;
  /** Open the dropdown above the trigger (for footer / bottom-of-viewport use). */
  openUp?: boolean;
  /** Which edge the dropdown aligns to. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm hover:bg-surface-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-accent">
          {initials(name)}
        </span>
        <span className="hidden text-fg-muted sm:block">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-40 w-60 rounded-lg border border-border bg-surface p-1.5 shadow-lg",
            openUp ? "bottom-full mb-1.5" : "mt-1.5",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="px-2.5 py-2">
            <div className="text-sm font-medium text-fg">{name}</div>
            <div className="text-xs capitalize text-fg-subtle">
              {role.toLowerCase().replace("_", " ")}
            </div>
          </div>
          <div className="my-1 flex items-center justify-between px-2.5 py-1.5">
            <span className="text-xs text-fg-muted">Theme</span>
            <ThemeToggle />
          </div>
          <div className="my-1 h-px bg-border" />
          {residentHref && (
            <Link
              href={residentHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Home className="h-4 w-4" /> Resident view
            </Link>
          )}
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            <UserRound className="h-4 w-4" /> Account
          </Link>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-2 hover:text-fg">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
