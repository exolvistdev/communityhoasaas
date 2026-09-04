"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateOrg } from "@/app/platform/actions";

export function ActivateOrgButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      <button
        onClick={() => {
          if (!confirm("Mark this org's contract/payment as settled and reactivate it?"))
            return;
          setError(null);
          start(async () => {
            const res = await activateOrg(orgId);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        disabled={pending}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Activating…" : "Activate (contract/payment settled)"}
      </button>
      {error && <span className="text-xs text-danger-fg">{error}</span>}
    </div>
  );
}
