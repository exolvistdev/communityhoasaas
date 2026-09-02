"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@prisma/client";
import { setListingStatus, renewListing } from "../actions";

export function SellerControls({
  listingId,
  status,
  expired,
}: {
  listingId: string;
  status: ListingStatus;
  expired: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: "ACTIVE" | "SOLD" | "WITHDRAWN") {
    setError(null);
    start(async () => {
      const res = await setListingStatus(listingId, next);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function renew() {
    setError(null);
    start(async () => {
      const res = await renewListing(listingId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="text-xs font-medium text-fg-muted">Manage your listing</div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/portal/market/${listingId}/edit`}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-surface-2"
        >
          Edit
        </Link>
        {expired && status === "ACTIVE" && (
          <button
            onClick={renew}
            disabled={pending}
            className="rounded-md border border-warning/30 px-3 py-1.5 text-sm font-medium text-warning-fg hover:bg-warning-subtle disabled:opacity-50"
          >
            Renew (expired)
          </button>
        )}
        {status !== "SOLD" && (
          <button
            onClick={() => change("SOLD")}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            Mark as sold
          </button>
        )}
        {status !== "ACTIVE" && (
          <button
            onClick={() => change("ACTIVE")}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
        {status !== "WITHDRAWN" && (
          <button
            onClick={() => change("WITHDRAWN")}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
          >
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
