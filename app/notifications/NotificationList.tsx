"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeTime } from "@/lib/format";
import { markRead, markAllRead } from "./actions";

export type Item = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function NotificationList({ items }: { items: Item[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const anyUnread = items.some((i) => !i.readAt);

  function open(item: Item) {
    start(async () => {
      if (!item.readAt) await markRead(item.id);
      if (item.href) router.push(item.href);
      else router.refresh();
    });
  }

  const groups: { label: string; items: Item[] }[] = [];
  for (const it of items) {
    const label = dayLabel(it.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }

  return (
    <div className="space-y-6">
      {anyUnread && (
        <div className="flex justify-end">
          <button
            disabled={pending}
            onClick={() => start(() => markAllRead())}
            className="text-sm text-brand-accent hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {g.label}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {g.items.map((n) => (
              <li key={n.id} className="border-b border-border last:border-0">
                <button
                  onClick={() => open(n)}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.readAt ? "bg-transparent" : "bg-brand-accent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${
                        n.readAt ? "text-fg-muted" : "font-medium text-fg"
                      }`}
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-xs text-fg-muted">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-fg-subtle">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
