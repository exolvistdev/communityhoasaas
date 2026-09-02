"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unblockUser } from "@/app/portal/messages/actions";

export function BlockedResidents({
  blocked,
}: {
  blocked: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (blocked.length === 0)
    return <p className="text-sm text-fg-subtle">You haven&apos;t blocked anyone.</p>;

  return (
    <ul className="divide-y divide-border">
      {blocked.map((b) => (
        <li key={b.id} className="flex items-center justify-between py-2 text-sm">
          <span className="text-fg">{b.name}</span>
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await unblockUser(b.id);
                router.refresh();
              })
            }
            className="text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  );
}
