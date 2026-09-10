"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setAnalytics } from "@/lib/consent";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

/**
 * Inline "change your choice" control for the Privacy Policy page — the
 * marketing footer no longer carries one. Reflects the current opt-out state
 * and flips it. Self-contained: no dependency on the popup being mounted.
 * Shows a neutral line until mounted so it never claims the wrong status.
 */
export function AnalyticsPreference() {
  const allowed = useAnalyticsConsent();
  const known = allowed !== null;
  const [blocked, setBlocked] = useState(false);

  function toggle() {
    if (!known) return;
    setBlocked(!setAnalytics(!allowed));
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <p className="text-sm text-fg-muted">
        {known ? (
          <>
            Visit analytics is currently{" "}
            <strong className="font-medium text-fg">
              {allowed ? "on" : "off"}
            </strong>{" "}
            for this browser.
          </>
        ) : (
          "Checking your current choice…"
        )}
        {blocked && (
          <span className="mt-1 block text-xs text-danger">
            Your browser is blocking the storage we need to save this.
          </span>
        )}
      </p>
      <Button size="sm" variant="secondary" disabled={!known} onClick={toggle}>
        {allowed ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}
