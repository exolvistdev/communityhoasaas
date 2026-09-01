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
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs font-medium text-gray-500">Manage your listing</div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/portal/market/${listingId}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Edit
        </Link>
        {expired && status === "ACTIVE" && (
          <button
            onClick={renew}
            disabled={pending}
            className="rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Renew (expired)
          </button>
        )}
        {status !== "SOLD" && (
          <button
            onClick={() => change("SOLD")}
            disabled={pending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Mark as sold
          </button>
        )}
        {status !== "ACTIVE" && (
          <button
            onClick={() => change("ACTIVE")}
            disabled={pending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
        {status !== "WITHDRAWN" && (
          <button
            onClick={() => change("WITHDRAWN")}
            disabled={pending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
