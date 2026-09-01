"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
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
  USED: {
    label: "Already used",
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

const CameraIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 9a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12.5" cy="13" r="3.2" />
  </svg>
);

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
  const [scanning, setScanning] = useState(false);

  const runCheck = useCallback((value: string) => {
    if (!value.trim()) return;
    start(async () => {
      const res = await validatePass(value);
      setResult(res);
      setRecent((r) => [res, ...r].slice(0, 12));
      setCode("");
      inputRef.current?.focus();
    });
  }, []);

  const onDecode = useCallback(
    (text: string) => {
      setScanning(false);
      runCheck(text);
    },
    [runCheck]
  );
  const closeScan = useCallback(() => setScanning(false), []);

  const v = result ? VERDICT[result.verdict] : null;

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCheck(code);
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium text-gray-700">
          Visitor pass code
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <CameraIcon />
            </span>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. K7M4PQ2R"
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 font-mono text-lg tracking-widest outline-none focus:border-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="shrink-0 rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "…" : "Check"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setScanning((s) => !s)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <CameraIcon />
          {scanning ? "Stop camera" : "Scan QR"}
        </button>
      </form>

      {scanning && <CameraScan onDecode={onDecode} onClose={closeScan} />}

      {/* result panel */}
      {!result ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Scan or type a visitor&apos;s pass code to check it.
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
              {result.verdict === "USED" && result.usedAt && (
                <div className="font-medium">
                  Used {fmtTime(result.usedAt)}
                </div>
              )}
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

function CameraScan({
  onDecode,
  onClose,
}: {
  onDecode: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (stopped || !video || !ctx) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height);
        if (found?.data) {
          stopped = true;
          onDecode(found.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
          raf = requestAnimationFrame(tick);
        }
      })
      .catch(() => setError("Camera unavailable — type the code instead."));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDecode]);

  if (error) {
    return (
      <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {error}{" "}
        <button onClick={onClose} className="underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-300 bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        className="aspect-square w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-40 w-40 rounded-lg border-2 border-white/80" />
      </div>
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs text-white"
      >
        Close
      </button>
    </div>
  );
}
