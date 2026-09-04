import { Building2, Hammer } from "lucide-react";

/**
 * Shared route-transition loading state — a house under construction, in the
 * app's dark-indigo identity (same Building2 badge as the login page and
 * sidebar). Rendered by every top-level loading.tsx so every role gets one
 * consistent loading identity, regardless of the page's own light/dark theme.
 */
export function HouseBuildingLoader({
  message = "Building your view…",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="absolute -inset-3 animate-pulse rounded-full bg-indigo-500/20 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
          <Building2 className="h-8 w-8" />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-7 w-7 origin-bottom-left animate-swing items-center justify-center rounded-full bg-slate-900 text-indigo-400 shadow-md">
          <Hammer className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-400">{message}</p>
    </div>
  );
}
