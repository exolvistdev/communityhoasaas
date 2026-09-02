"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { typeDefaultRate, type TypeRateDefaults } from "@/lib/rate";
import { addProperty } from "./actions";

type Plan = { id: string; name: string; monthlyRate: number };
type PropertyType = "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE";

export function AddPropertyForm({
  ratePlans,
  typeDefaults,
}: {
  ratePlans: Plan[];
  typeDefaults: TypeRateDefaults;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [type, setType] = useState<PropertyType>("RESIDENTIAL");
  const [rateChoice, setRateChoice] = useState("custom");
  const [customRate, setCustomRate] = useState("");

  const selectedPlan = ratePlans.find((p) => p.id === rateChoice) ?? null;
  const typeDefault = typeDefaultRate(typeDefaults, type);
  const usingTypeDefault = rateChoice === "type-default";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    start(async () => {
      const res = await addProperty({
        unitNumber: fd.get("unitNumber"),
        type,
        monthlyRate: selectedPlan
          ? selectedPlan.monthlyRate
          : usingTypeDefault
          ? undefined
          : customRate,
        ratePlanId: selectedPlan ? selectedPlan.id : "",
        homeownerName: fd.get("homeownerName"),
        homeownerEmail: fd.get("homeownerEmail"),
      });
      if (res.ok) {
        form.reset();
        setType("RESIDENTIAL");
        setRateChoice("custom");
        setCustomRate("");
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
      >
        Add property
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-fg">Unit number</span>
          <input
            name="unitNumber"
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
              if (rateChoice === "type-default" && typeDefaultRate(typeDefaults, next) == null)
                setRateChoice("custom");
            }}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="TOWNHOUSE">Townhouse</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-fg">Rate</span>
          <select
            value={rateChoice}
            onChange={(e) => setRateChoice(e.target.value)}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            {ratePlans.map((p) => (
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
        </label>
        {!selectedPlan && !usingTypeDefault && (
          <label className="text-sm">
            <span className="text-fg">Monthly rate (₱)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
        )}
        <label className="text-sm">
          <span className="text-fg">Primary homeowner (optional)</span>
          <input
            name="homeownerName"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm">
          <span className="text-fg">Homeowner email (optional)</span>
          <input
            name="homeownerEmail"
            type="email"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-danger-fg">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save property"}
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
