"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPropertyArchived } from "./actions";

export function ArchivePropertyButton({
  id,
  archived,
  balance,
}: {
  id: string;
  archived: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    if (!archived) {
      const msg =
        balance > 0
          ? `This unit still owes ₱${balance.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}. Archive anyway? It will stop being billed but its balance stays on record.`
          : "Archive this unit? It stops being billed and is hidden from the active list.";
      if (!confirm(msg)) return;
    }
    start(async () => {
      await setPropertyArchived(id, !archived);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {pending
        ? "…"
        : archived
        ? "Restore property"
        : "Archive property"}
    </button>
  );
}
