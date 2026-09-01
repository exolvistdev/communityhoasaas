"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeGatePass } from "./actions";

export function RevokeGatePassButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("Revoke this gate pass? The visitor will be turned away."))
          return;
        start(async () => {
          await revokeGatePass(id);
          router.refresh();
        });
      }}
      disabled={pending}
      className="text-xs text-red-500 underline hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
