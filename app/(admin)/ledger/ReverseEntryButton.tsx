"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reverseManualEntry } from "./actions";

export function ReverseEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => {
          if (!confirm("Post a reversing entry to cancel this one?")) return;
          setErr(null);
          start(async () => {
            const r = await reverseManualEntry(id);
            if (r.ok) router.refresh();
            else setErr(r.error);
          });
        }}
        disabled={pending}
        className="text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
      >
        {pending ? "Reversing…" : "Reverse"}
      </button>
      {err && <span className="text-xs text-danger-fg">{err}</span>}
    </span>
  );
}
