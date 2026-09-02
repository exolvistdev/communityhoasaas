"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "./actions";

export function CancelBookingButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        onClick={() => {
          if (!confirm("Cancel this booking?")) return;
          setError(null);
          start(async () => {
            const res = await cancelBooking(id);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        disabled={pending}
        className="text-xs text-red-500 underline hover:text-red-700 disabled:opacity-50"
      >
        {pending ? "…" : "Cancel"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </span>
  );
}
