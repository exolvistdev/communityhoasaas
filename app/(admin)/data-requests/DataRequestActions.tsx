"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveDataRequest } from "./actions";

export function DataRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function act(status: "COMPLETED" | "REJECTED", note?: string) {
    setErr(null);
    start(async () => {
      const res = await resolveDataRequest(id, { status, note });
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <button
        onClick={() => {
          if (!confirm("Mark this request as done? Handle the deletion itself first.")) return;
          act("COMPLETED");
        }}
        disabled={pending}
        className="font-medium text-fg-muted underline hover:text-fg disabled:opacity-50"
      >
        Mark done
      </button>
      <button
        onClick={() => {
          const note = prompt("Reason for rejecting (shown to the resident):");
          if (note == null) return;
          act("REJECTED", note.trim() || undefined);
        }}
        disabled={pending}
        className="font-medium text-danger-fg underline disabled:opacity-50"
      >
        Reject
      </button>
      {err && <span className="text-danger-fg">{err}</span>}
    </div>
  );
}
