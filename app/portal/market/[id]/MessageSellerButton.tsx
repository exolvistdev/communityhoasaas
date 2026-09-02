"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/portal/messages/actions";

export function MessageSellerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await startConversation(listingId);
            if (res.ok) router.push(`/portal/messages/${res.conversationId}`);
            else setError(res.error);
          });
        }}
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "…" : "Message seller"}
      </button>
      {error && <p className="mt-1 text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
