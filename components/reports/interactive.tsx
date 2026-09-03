"use client";

import { useEffect } from "react";

/**
 * Shared bits for the interactive report bodies (aging, payables, income &
 * expenses). A chart click sets a local filter; these keep it honest:
 *  - `useClearOnPrint` wipes the filter before the browser prints, so the
 *    printed report / board pack always shows the full, unfiltered tables
 *    (spec §4 / §6).
 *  - `<FilterChip>` is the `.no-print` "Showing … · Clear" affordance.
 */
export function useClearOnPrint(clear: () => void) {
  useEffect(() => {
    window.addEventListener("beforeprint", clear);
    return () => window.removeEventListener("beforeprint", clear);
  }, [clear]);
}

export function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="no-print mt-3 flex items-center gap-2 text-xs">
      <span className="rounded-full bg-brand-subtle px-2.5 py-1 font-medium text-brand-accent">
        Showing {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-gray-500 underline hover:text-gray-900"
      >
        Clear filter
      </button>
    </div>
  );
}
