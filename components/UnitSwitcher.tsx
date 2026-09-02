"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { setActiveUnit } from "@/app/portal/actions";

export function UnitSwitcher({
  units,
  activePropertyId,
}: {
  units: { propertyId: string; unitNumber: string }[];
  activePropertyId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Switch unit</span>
      <select
        value={activePropertyId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          start(async () => {
            await setActiveUnit(id);
            router.refresh();
          });
        }}
        className="appearance-none rounded-md border border-border bg-surface py-1 pl-2 pr-6 text-xs text-fg-muted outline-none focus:border-brand disabled:opacity-50"
      >
        {units.map((u) => (
          <option key={u.propertyId} value={u.propertyId}>
            {u.unitNumber}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-fg-subtle" />
    </label>
  );
}
