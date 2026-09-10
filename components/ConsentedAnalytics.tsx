"use client";

import { Analytics } from "@vercel/analytics/react";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

/**
 * Vercel Web Analytics, mounted for every marketing-site visitor unless they
 * opt out — the popup's Decline, turning analytics off under Manage, or the
 * control on the Privacy Policy page. Cookieless and first-party
 * (`/_vercel/insights/*`) — a daily-rotating hash, no persistent id, no
 * cross-site tracking. Unmounts if the visitor opts out later. No-ops off
 * Vercel / in dev.
 */
export function ConsentedAnalytics() {
  return useAnalyticsConsent() ? <Analytics /> : null;
}
