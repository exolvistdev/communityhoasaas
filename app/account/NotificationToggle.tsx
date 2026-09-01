"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEmailNotifications } from "./actions";

export function NotificationToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-700">
        Email me about new marketplace messages and moderation
      </span>
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            await setEmailNotifications(next);
            router.refresh();
          });
        }}
        className="h-4 w-4"
      />
    </label>
  );
}
