"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { peso } from "@/lib/format";
import { validateRows, type ParseResult, type ValidRow } from "@/lib/csv";
import type { TypeRateDefaults } from "@/lib/rate";
import { importProperties } from "@/app/(admin)/properties/actions";

const TYPE_LABEL: Record<ValidRow["type"], string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  TOWNHOUSE: "Townhouse",
};

type Imported = { imported: number; skipped: number } | null;

export function PropertyCsvImport({
  onComplete,
  completeLabel = "Done",
  onBack,
  typeDefaults,
}: {
  onComplete: () => void;
  completeLabel?: string;
  onBack?: () => void;
  /** Org defaults used to fill in a missing rate column, per property type. */
  typeDefaults?: TypeRateDefaults;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [imported, setImported] = useState<Imported>(null);
  const [pending, start] = useTransition();
  const [importErr, setImportErr] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (out) => {
        if (out.errors.length && !out.data.length) {
          setParseError("Could not read this file as CSV.");
          return;
        }
        setResult(validateRows(out.data, { typeDefaults }));
      },
      error: () => setParseError("Could not read this file."),
    });
  }, [typeDefaults]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  function commit() {
    if (!result?.valid.length) return;
    setImportErr(null);
    start(async () => {
      const res = await importProperties(result.valid);
      if (res.ok) setImported({ imported: res.imported, skipped: res.skipped });
      else setImportErr(res.error);
    });
  }

  const preview = useMemo(() => result?.valid.slice(0, 8) ?? [], [result]);
  const withOwners = useMemo(
    () => (result?.valid ?? []).some((r) => r.homeownerName),
    [result]
  );

  if (imported) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-2xl text-success-fg">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-semibold text-fg">
            {imported.imported} propert{imported.imported === 1 ? "y" : "ies"}{" "}
            imported
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {imported.skipped > 0
              ? `${imported.skipped} row(s) matched an existing unit and were skipped.`
              : "All rows added."}
          </p>
        </div>
        <button
          onClick={onComplete}
          className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
        >
          {completeLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-muted">
        CSV columns: <code className="text-fg">unit number</code>,{" "}
        <code className="text-fg">type</code>. Optional:{" "}
        <code className="text-fg">monthly rate</code> (falls back to the type
        default when blank), <code className="text-fg">homeowner name</code>,{" "}
        <code className="text-fg">email</code>,{" "}
        <code className="text-fg">phone</code>.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center text-sm ${
          dragOver
            ? "border-gray-900 bg-surface-2"
            : "border-border hover:border-border-strong"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {fileName ? (
          <span className="text-fg">
            <span className="font-medium">{fileName}</span> — click to replace
          </span>
        ) : (
          <span className="text-fg-muted">
            Drag a CSV here, or{" "}
            <span className="text-fg underline">browse</span>
          </span>
        )}
      </div>

      {parseError && (
        <p className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {parseError}
        </p>
      )}

      {result && result.missingColumns.length > 0 && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          Missing required column(s): {result.missingColumns.join(", ")}. Check
          the header row and re-upload.
        </div>
      )}

      {result && result.errors.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm">
          <p className="font-medium text-warning-fg">
            {result.errors.length} row(s) could not be read and will be skipped:
          </p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-warning-fg">
            {result.errors.slice(0, 50).map((err, i) => (
              <li key={i}>
                Row {err.line}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.valid.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium text-fg">
            {result.valid.length} propert
            {result.valid.length === 1 ? "y" : "ies"} detected
            {result.valid.length > preview.length &&
              ` — showing first ${preview.length}`}
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-fg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Monthly rate
                  </th>
                  {withOwners && (
                    <th className="px-3 py-2 font-medium">Homeowner</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{r.unitNumber}</td>
                    <td className="px-3 py-2">{TYPE_LABEL[r.type]}</td>
                    <td className="px-3 py-2 text-right">
                      {peso(r.monthlyRate)}
                    </td>
                    {withOwners && (
                      <td className="px-3 py-2 text-fg-muted">
                        {r.homeownerName ?? "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importErr && (
        <p className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {importErr}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-2"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={commit}
          disabled={pending || !result?.valid.length}
          className="rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending
            ? "Importing…"
            : result?.valid.length
            ? `Import ${result.valid.length} propert${
                result.valid.length === 1 ? "y" : "ies"
              }`
            : "Import properties"}
        </button>
      </div>
    </div>
  );
}
