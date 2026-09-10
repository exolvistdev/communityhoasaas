"use client";

import { useEffect, useState } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/consent";

/**
 * Live "is analytics allowed for this browser?" — `null` until mounted so the
 * server and first client render agree, then `true` / `false`, re-syncing on
 * every `CONSENT_CHANGE_EVENT`.
 */
export function useAnalyticsConsent(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setAllowed(readConsent().analytics);
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  return allowed;
}
