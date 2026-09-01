"use client";

import Link from "next/link";

export function PrintToolbar({ csvHref }: { csvHref: string }) {
  return (
    <div className="no-print mb-6 flex items-center justify-between">
      <Link
        href="/billing"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Back to billing
      </Link>
      <div className="flex gap-2">
        <a
          href={csvHref}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Download CSV
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
