"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { typeDefaultRate, type TypeRateDefaults } from "@/lib/rate";
import { createRatePlan } from "../../settings/actions";
import { updateProperty } from "./actions";

type Plan = { id: string; name: string; monthlyRate: number };
type PropertyType = "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE";

type Props = {
  property: {
    id: string;
    unitNumber: string;
    type: PropertyType;
    monthlyRate: number;
    ratePlanId: string | null;
  };
  ratePlans: Plan[];
  typeDefaults: TypeRateDefaults;
};

export function EditPropertyForm({ property, ratePlans, typeDefaults }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<Plan[]>(ratePlans);
  const [type, setType] = useState<PropertyType>(property.type);
  const [rateChoice, setRateChoice] = useState<string>(
    property.ratePlanId ?? "custom"
  );
  const [customRate, setCustomRate] = useState(String(property.monthlyRate));

  const typeDefault = typeDefaultRate(typeDefaults, type);

  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanRate, setNewPlanRate] = useState("");
  const [creatingPlan, startCreatePlan] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        Edit property
      </button>
    );
  }

  function addPlan() {
    setError(null);
    startCreatePlan(async () => {
      const res = await createRatePlan({
        name: newPlanName,
        monthlyRate: newPlanRate,
      });
      if (res.ok) {
        setPlans((p) => [...p, res.plan]);
        setRateChoice(res.plan.id);
        setShowNewPlan(false);
        setNewPlanName("");
        setNewPlanRate("");
      } else setError(res.error);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updateProperty(property.id, {
        unitNumber: fd.get("unitNumber"),
        type,
        ...(rateChoice === "custom"
          ? { customRate }
          : rateChoice === "type-default"
          ? { useTypeDefault: true }
          : { ratePlanId: rateChoice }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-fg">Unit number</span>
          <input
            name="unitNumber"
            defaultValue={property.unitNumber}
            required
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm">
          <span className="text-fg">Type</span>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as PropertyType;
              setType(next);
              if (
                rateChoice === "type-default" &&
                typeDefaultRate(typeDefaults, next) == null
              )
                setRateChoice("custom");
            }}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="TOWNHOUSE">Townhouse</option>
          </select>
        </label>
      </div>

      <div className="text-sm">
        <span className="text-fg">Rate</span>
        <select
          value={rateChoice}
          onChange={(e) => setRateChoice(e.target.value)}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {peso(p.monthlyRate)}
            </option>
          ))}
          {typeDefault != null && (
            <option value="type-default">
              Use type default — {peso(typeDefault)}
            </option>
          )}
          <option value="custom">Custom rate…</option>
        </select>

        {rateChoice === "custom" && (
          <input
            type="number"
            min="0"
            step="0.01"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
            required
            className="mt-2 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            placeholder="Monthly rate (₱)"
          />
        )}

        {!showNewPlan ? (
          <button
            type="button"
            onClick={() => setShowNewPlan(true)}
            className="mt-2 text-xs text-fg-muted underline hover:text-fg"
          >
            ＋ New rate plan
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-surface-2 p-2">
            <label className="text-xs">
              <span className="text-fg-muted">Plan name</span>
              <input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                className="mt-1 block rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
              />
            </label>
            <label className="text-xs">
              <span className="text-fg-muted">Rate (₱)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newPlanRate}
                onChange={(e) => setNewPlanRate(e.target.value)}
                className="mt-1 block w-28 rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
              />
            </label>
            <button
              type="button"
              onClick={addPlan}
              disabled={creatingPlan}
              className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {creatingPlan ? "Adding…" : "Add plan"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewPlan(false)}
              className="text-xs text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
