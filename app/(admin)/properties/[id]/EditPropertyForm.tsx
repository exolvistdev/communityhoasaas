"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { createRatePlan } from "../../settings/actions";
import { updateProperty } from "./actions";

type Plan = { id: string; name: string; monthlyRate: number };

type Props = {
  property: {
    id: string;
    unitNumber: string;
    type: "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE";
    monthlyRate: number;
    ratePlanId: string | null;
  };
  ratePlans: Plan[];
};

export function EditPropertyForm({ property, ratePlans }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<Plan[]>(ratePlans);
  const [rateChoice, setRateChoice] = useState<string>(
    property.ratePlanId ?? "custom"
  );
  const [customRate, setCustomRate] = useState(String(property.monthlyRate));

  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanRate, setNewPlanRate] = useState("");
  const [creatingPlan, startCreatePlan] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
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
        type: fd.get("type"),
        ...(rateChoice === "custom"
          ? { customRate }
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
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-gray-700">Unit number</span>
          <input
            name="unitNumber"
            defaultValue={property.unitNumber}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-700">Type</span>
          <select
            name="type"
            defaultValue={property.type}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="TOWNHOUSE">Townhouse</option>
          </select>
        </label>
      </div>

      <div className="text-sm">
        <span className="text-gray-700">Rate</span>
        <select
          value={rateChoice}
          onChange={(e) => setRateChoice(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {peso(p.monthlyRate)}
            </option>
          ))}
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
            className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
            placeholder="Monthly rate (₱)"
          />
        )}

        {!showNewPlan ? (
          <button
            type="button"
            onClick={() => setShowNewPlan(true)}
            className="mt-2 text-xs text-gray-500 underline hover:text-gray-900"
          >
            ＋ New rate plan
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-2">
            <label className="text-xs">
              <span className="text-gray-600">Plan name</span>
              <input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
              />
            </label>
            <label className="text-xs">
              <span className="text-gray-600">Rate (₱)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newPlanRate}
                onChange={(e) => setNewPlanRate(e.target.value)}
                className="mt-1 block w-28 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
              />
            </label>
            <button
              type="button"
              onClick={addPlan}
              disabled={creatingPlan}
              className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {creatingPlan ? "Adding…" : "Add plan"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewPlan(false)}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
