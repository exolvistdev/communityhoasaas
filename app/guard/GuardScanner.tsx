"use client";

import { useRef, useState, useTransition } from "react";
import { validatePass, type ScanResult, type ScanVerdict } from "./actions";

const VERDICT: Record<
  ScanVerdict,
  { label: string; ok: boolean; panel: string; chip: string }
> = {
  VALID: {
    label: "Valid — let them in",
    ok: true,
    panel: "bg-green-600 text-white",
    chip: "bg-green-100 text-green-800",
  },
  EXPIRED: {
    label: "Expired",
    ok: false,
    panel: "bg-red-600 text-white",
    chip: "bg-red-100 text-red-800",
  },
  NOT_YET_VALID: {
    label: "Not valid yet",
    ok: false,
    panel: "bg-red-600 text-white",
    chip: "bg-red-100 text-red-800",
  },
  REVOKED: {
    label: "Revoked",
    ok: false,
    panel: "bg-red-600 text-white",
    chip: "bg-red-100 text-red-800",
  },
  NOT_FOUND: {
    label: "No matching pass",
    ok: false,
    panel: "bg-red-600 text-white",
    chip: "bg-gray-200 text-gray-700",
  },
};

const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export function GuardScanner({
  initialRecent,
}: {
  initialRecent: ScanResult[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<ScanResult[]>(initialRecent);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const entered = code.trim().toUpperCase();
    if (!entered) return;
    start(async () => {
      const res = await validatePass(entered);
      setResult(res);
      setRecent((r) => [res, ...r].slice(0, 12));
      setCode("");
      inputRef.current?.focus();
    });
  }

  const v = result ? VERDICT[result.verdict] : null;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Visitor pass code
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="e.g. K7M4PQ2R"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-lg tracking-widest outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="shrink-0 rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "…" : "Check"}
          </button>
        </div>
      </form>

      {/* result panel */}
      {!result ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Enter a visitor&apos;s pass code to check it.
        </div>
      ) : (
        <div className={`rounded-xl p-6 ${v!.panel}`}>
          <div className="text-5xl leading-none">{v!.ok ? "✓" : "✕"}</div>
          <div className="mt-2 text-lg font-semibold">{v!.label}</div>
          {result.verdict === "NOT_FOUND" ? (
            <div className="mt-1 font-mono text-sm opacity-90">
              {result.code || "—"}
            </div>
          ) : (
            <div className="mt-3 space-y-0.5 text-sm">
              <div className="text-xl font-semibold">{result.visitorName}</div>
              <div className="opacity-90">Unit {result.unitNumber}</div>
              <div className="opacity-90">
                {fmtTime(result.validFrom)} – {fmtTime(result.validUntil)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* recent scans */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Recent checks
          </h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {recent.map((r, i) => {
              const rv = VERDICT[r.verdict];
              return (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono">{r.code || "—"}</span>
                    {r.visitorName && (
                      <span className="ml-2 text-gray-500">
                        {r.visitorName} · Unit {r.unitNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${rv.chip}`}
                    >
                      {r.verdict === "VALID" ? "Valid" : rv.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.scannedAt).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
