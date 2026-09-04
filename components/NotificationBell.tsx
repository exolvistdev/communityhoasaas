"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { markRead, markAllRead } from "@/app/notifications/actions";

export type BellItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

export function NotificationBell({
  unread,
  recent,
  openUp = false,
  align = "right",
}: {
  unread: number;
  recent: BellItem[];
  /** Open the dropdown above the trigger (for footer / bottom-of-viewport use). */
  openUp?: boolean;
  /** Which edge the dropdown aligns to. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function openItem(item: BellItem) {
    setOpen(false);
    start(async () => {
      if (!item.readAt) await markRead(item.id);
      if (item.href) router.push(item.href);
      else router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-40 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg",
            openUp ? "bottom-full mb-1.5" : "mt-1.5",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium text-fg">Notifications</span>
            {unread > 0 && (
              <button
                disabled={pending}
                onClick={() => start(() => markAllRead())}
                className="text-xs text-brand-accent hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-subtle">
                You&rsquo;re all caught up.
              </p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-surface-2"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.readAt ? "bg-transparent" : "bg-brand-accent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">{n.title}</span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-fg-subtle">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
}
