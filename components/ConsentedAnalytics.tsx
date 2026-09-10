"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/consent";

/**
 * Vercel Web Analytics, mounted for every marketing-site visitor unless they
 * opt out from the notice or the footer "Cookie settings" control. Cookieless
 * and first-party (`/_vercel/insights/*`) — a daily-rotating hash, no persistent
 * id, no cross-site tracking. Unmounts if the visitor opts out later. No-ops off
 * Vercel / in dev.
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
