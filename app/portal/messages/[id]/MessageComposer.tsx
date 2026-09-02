"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "../actions";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const body = ref.current?.value ?? "";
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await sendMessage(conversationId, { body });
      if (res.ok) {
        if (ref.current) ref.current.value = "";
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={2}
          maxLength={2000}
          placeholder="Write a message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
