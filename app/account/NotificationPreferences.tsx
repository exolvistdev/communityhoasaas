"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateNotificationPrefs } from "./actions";

type Channels = { email: boolean; inApp: boolean };
type Category = { key: string; label: string; hint: string };

export function NotificationPreferences({
  categories,
  emailNotifications,
  prefs,
}: {
  categories: Category[];
  emailNotifications: boolean;
  prefs: Record<string, Channels>;
}) {
  const router = useRouter();
  const [master, setMaster] = useState(emailNotifications);
  const [grid, setGrid] = useState<Record<string, Channels>>(prefs);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(key: string, channel: keyof Channels) {
    setSaved(false);
    setGrid((g) => ({
      ...g,
      [key]: { ...g[key], [channel]: !g[key][channel] },
    }));
  }

  function save() {
    setSaved(false);
    start(async () => {
      const res = await updateNotificationPrefs({
        emailNotifications: master,
        prefs: grid,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-fg">
          Email notifications
          <span className="mt-0.5 block text-xs text-fg-subtle">
            Master switch — off means no email for any category.
          </span>
        </span>
        <input
          type="checkbox"
          checked={master}
          onChange={(e) => {
            setSaved(false);
            setMaster(e.target.checked);
          }}
          className="h-4 w-4"
        />
      </label>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-fg-subtle">
          <span>Category</span>
          <span className="w-12 text-center">Email</span>
          <span className="w-12 text-center">In-app</span>
        </div>
        {categories.map((c) => (
          <div
            key={c.key}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-border px-3 py-2.5 last:border-0"
          >
            <span className="text-sm text-fg">
              {c.label}
              <span className="mt-0.5 block text-xs text-fg-subtle">
                {c.hint}
              </span>
            </span>
            <span className="w-12 text-center">
              <input
                type="checkbox"
                checked={master && grid[c.key].email}
                disabled={!master}
                onChange={() => toggle(c.key, "email")}
                className="h-4 w-4 disabled:opacity-40"
              />
            </span>
            <span className="w-12 text-center">
              <input
                type="checkbox"
                checked={grid[c.key].inApp}
                onChange={() => toggle(c.key, "inApp")}
                className="h-4 w-4"
              />
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand-hi disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-xs text-success-fg">Saved</span>}
      </div>
    </div>
  );
}
