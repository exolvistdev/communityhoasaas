"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renewListing } from "../actions";

export function RenewButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await renewListing(id);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        disabled={pending}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? "…" : "Renew"}
      </button>
      {error && <span className="ml-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
