"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Opens the bulk Statement of Account view. Shows a brief "Preparing…" state
 *  while the statements render (Wireframe Brief §4.3 "bulk SOA export in progress"). */
export function StatementsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => router.push("/statements?scope=outstanding"))}
      disabled={pending}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Preparing statements…" : "Statements"}
    </button>
  );
}
