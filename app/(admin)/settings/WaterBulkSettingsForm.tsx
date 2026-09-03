"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WATER_LOSS_POLICY_OPTIONS } from "@/lib/water";
import { updateWaterBulkConfig } from "./actions";

export function WaterBulkSettingsForm({
  config,
  vendors,
}: {
  config: {
    enabled: boolean;
    vendorId: string | null;
    lossPolicy: "DISTRIBUTE" | "ABSORB";
    adminFeeFlat: number | null;
  };
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(config.enabled);
  const [vendorId, setVendorId] = useState(config.vendorId ?? "");
  const [newVendorName, setNewVendorName] = useState("");
  const [lossPolicy, setLossPolicy] = useState(config.lossPolicy);
  const [adminFee, setAdminFee] = useState(
    config.adminFeeFlat != null ? String(config.adminFeeFlat) : ""
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateWaterBulkConfig({
        waterBillingEnabled: enabled,
        waterUtilityVendorId: newVendorName ? "" : vendorId,
        newVendorName,
        waterLossPolicy: lossPolicy,
        waterAdminFeeFlat: adminFee,
      });
      if (res.ok) {
        setSaved(true);
        setNewVendorName("");
        router.refresh();
      } else setError(res.error);
    });
  }

  const field =
    "w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
          className="h-4 w-4"
        />
        <span className="text-fg">Split the utility bill across sub-meters</span>
      </label>

      <label className="block text-sm">
        <span className="text-fg">Water utility (vendor)</span>
        <select
          value={vendorId}
          onChange={(e) => {
            setVendorId(e.target.value);
            setSaved(false);
          }}
          disabled={!!newVendorName}
          className={`mt-1 ${field} disabled:opacity-50`}
        >
          <option value="">— choose —</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          value={newVendorName}
          onChange={(e) => {
            setNewVendorName(e.target.value);
            setSaved(false);
          }}
          placeholder="…or add a new one (e.g. Maynilad)"
          className={`mt-2 ${field}`}
        />
      </label>

      <fieldset className="space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          System loss
        </span>
        {WATER_LOSS_POLICY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer gap-2.5 rounded-md border border-border p-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
          >
            <input
              type="radio"
              name="lossPolicy"
              value={o.value}
              checked={lossPolicy === o.value}
              onChange={() => {
                setLossPolicy(o.value);
                setSaved(false);
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-fg">{o.label}</span>
              <span className="block text-xs text-fg-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="text-fg">Admin fee per unit (₱ / month, optional)</span>
        <input
          type="number"
          min="0"
          step="1"
          value={adminFee}
          onChange={(e) => {
            setAdminFee(e.target.value);
            setSaved(false);
          }}
          className={`mt-1 ${field}`}
        />
      </label>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success-fg">Saved</span>
        )}
      </div>
    </form>
  );
}
