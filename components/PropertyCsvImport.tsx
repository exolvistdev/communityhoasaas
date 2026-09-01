"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { peso } from "@/lib/format";
import { validateRows, type ParseResult, type ValidRow } from "@/lib/csv";
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
}: {
  onComplete: () => void;
  completeLabel?: string;
  onBack?: () => void;
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
        setResult(validateRows(out.data));
      },
      error: () => setParseError("Could not read this file."),
    });
  }, []);

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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {imported.imported} propert{imported.imported === 1 ? "y" : "ies"}{" "}
            imported
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {imported.skipped > 0
              ? `${imported.skipped} row(s) matched an existing unit and were skipped.`
              : "All rows added."}
          </p>
        </div>
        <button
          onClick={onComplete}
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          {completeLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        CSV columns: <code className="text-gray-700">unit number</code>,{" "}
        <code className="text-gray-700">type</code>,{" "}
        <code className="text-gray-700">monthly rate</code>. Optional:{" "}
        <code className="text-gray-700">homeowner name</code>,{" "}
        <code className="text-gray-700">email</code>,{" "}
        <code className="text-gray-700">phone</code>.
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
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 hover:border-gray-400"
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
          <span className="text-gray-700">
            <span className="font-medium">{fileName}</span> — click to replace
          </span>
        ) : (
          <span className="text-gray-500">
            Drag a CSV here, or{" "}
            <span className="text-gray-900 underline">browse</span>
          </span>
        )}
      </div>

      {parseError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {parseError}
        </p>
      )}

      {result && result.missingColumns.length > 0 && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Missing required column(s): {result.missingColumns.join(", ")}. Check
          the header row and re-upload.
        </div>
      )}

      {result && result.errors.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            {result.errors.length} row(s) could not be read and will be skipped:
          </p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-amber-700">
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
          <div className="mb-2 text-sm font-medium text-gray-700">
            {result.valid.length} propert
            {result.valid.length === 1 ? "y" : "ies"} detected
            {result.valid.length > preview.length &&
              ` — showing first ${preview.length}`}
          </div>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.unitNumber}</td>
                    <td className="px-3 py-2">{TYPE_LABEL[r.type]}</td>
                    <td className="px-3 py-2 text-right">
                      {peso(r.monthlyRate)}
                    </td>
                    {withOwners && (
                      <td className="px-3 py-2 text-gray-600">
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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {importErr}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={commit}
          disabled={pending || !result?.valid.length}
          className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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
