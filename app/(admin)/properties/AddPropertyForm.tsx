"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { addProperty } from "./actions";

type Plan = { id: string; name: string; monthlyRate: number };

export function AddPropertyForm({ ratePlans }: { ratePlans: Plan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [planChoice, setPlanChoice] = useState("custom");
  const [customRate, setCustomRate] = useState("");

  const selectedPlan = ratePlans.find((p) => p.id === planChoice) ?? null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    start(async () => {
      const res = await addProperty({
        unitNumber: fd.get("unitNumber"),
        type: fd.get("type"),
        monthlyRate: selectedPlan ? selectedPlan.monthlyRate : customRate,
        ratePlanId: selectedPlan ? selectedPlan.id : "",
        homeownerName: fd.get("homeownerName"),
        homeownerEmail: fd.get("homeownerEmail"),
      });
      if (res.ok) {
        form.reset();
        setPlanChoice("custom");
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
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
      >
        Add property
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-gray-700">Unit number</span>
          <input
            name="unitNumber"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-700">Type</span>
          <select
            name="type"
            defaultValue="RESIDENTIAL"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="TOWNHOUSE">Townhouse</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-gray-700">Rate</span>
          <select
            value={planChoice}
            onChange={(e) => setPlanChoice(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          >
            {ratePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {peso(p.monthlyRate)}
              </option>
            ))}
            <option value="custom">Custom rate…</option>
          </select>
        </label>
        {!selectedPlan && (
          <label className="text-sm">
            <span className="text-gray-700">Monthly rate (₱)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
            />
          </label>
        )}
        <label className="text-sm">
          <span className="text-gray-700">Primary homeowner (optional)</span>
          <input
            name="homeownerName"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-700">Homeowner email (optional)</span>
          <input
            name="homeownerEmail"
            type="email"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save property"}
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
