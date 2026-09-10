"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  dismissForSession,
  readConsent,
  setAnalytics,
  wasDismissedThisSession,
} from "@/lib/consent";

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-in
  const [manage, setManage] = useState(false);
  const [analytics, setAnalyticsState] = useState(true);

  // Decide whether to show the first-visit popup, once, after mount (SSR-safe).
  useEffect(() => {
    setMounted(true);
    const c = readConsent();
    if (!c.acknowledged && !wasDismissedThisSession()) {
      setAnalyticsState(c.analytics);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  // Esc = close without choosing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted || !open) return null;

  function decide(allow: boolean) {
    setAnalytics(allow);
    setOpen(false);
  }

  function close() {
    dismissForSession();
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className={cn(
        "fixed bottom-4 inset-x-4 z-50 sm:left-4 sm:right-auto sm:max-w-md",
        "rounded-lg border border-border bg-surface p-4 shadow-lg",
        "transition-all duration-200",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-2.5 top-2.5 rounded p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>

      {!manage ? (
        <>
          <p className="pr-6 text-sm text-fg-muted">
            We count visits with Vercel Web Analytics — cookieless, no cross-site
            tracking, no profile of you. Sign-in cookies load only after you log
            in. See our{" "}
            <Link href="/privacy" className="text-brand-accent hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => decide(true)}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decide(false)}>
              Decline
            </Button>
            <Button size="sm" variant="link" onClick={() => setManage(true)}>
              Manage preferences
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="pr-6 text-sm font-medium text-fg">Cookie preferences</p>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Strictly necessary"
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-fg">Strictly necessary</span>
                <span className="block text-xs text-fg-muted">
                  Your login session and security, set only after you sign in.
                  Always on.
                </span>
              </span>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalyticsState(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-fg">
                  Count anonymous visits
                </span>
                <span className="block text-xs text-fg-muted">
                  Vercel Web Analytics — aggregate page views, no cookies, no
                  cross-site tracking.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => decide(analytics)}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setManage(false)}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
