"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/consent";

/**
 * Vercel Web Analytics, mounted only after the visitor accepts analytics in the
 * cookie banner. Cookieless and first-party (`/_vercel/insights/*`), but gated
 * anyway so the choice in the banner actually controls something. Unmounts if
 * consent is later withdrawn. No-ops off Vercel / in dev.
 */
export function ConsentedAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(readConsent().analytics);
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  return allowed ? <Analytics /> : null;
}
