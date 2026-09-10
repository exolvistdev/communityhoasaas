// Analytics-consent state for the public marketing site. Client-safe — no
// top-level window access, so it can be imported from server components too.
//
// Model: OPT-OUT. Vercel Web Analytics is cookieless (a daily-rotating one-way
// hash, no persistent id, no cross-site tracking, no PII stored), so it runs by
// default. A visitor opts out from the popup (Decline, or turning analytics off
// under Manage) or later from the control on the Privacy Policy page; the
// choice is sticky either way.

export type ConsentCategory = "necessary" | "analytics";

export type ConsentState = {
  /** the visitor has seen and dismissed the transparency notice */
  acknowledged: boolean;
  /** analytics allowed — defaults to true, false only after an explicit opt-out */
  analytics: boolean;
  /** ISO timestamp of the stored record, or null */
  at: string | null;
};

// Frozen — these are returned by reference from parseConsent / readConsent.
const DEFAULT: ConsentState = Object.freeze({
  acknowledged: false,
  analytics: true,
  at: null,
});

export const CONSENT_KEY = "hoa_cookie_consent";
export const SESSION_DISMISS_KEY = "hoa_cookie_dismissed";
/**
 * Bump when the disclosure materially changes: it re-shows the popup for
 * everyone (clears `acknowledged`). An explicit opt-out is preserved across the
 * bump — see `parseConsent` — and the re-shown popup still offers Accept, so an
 * opted-out visitor can opt back in.
 */
export const CONSENT_VERSION = 1;

export const CONSENT_CHANGE_EVENT = "hoa:consent-change";

/**
 * Pure: turn a stored consent string into state. Falls back to the default
 * (analytics on, notice not yet acknowledged) when the record is missing,
 * malformed, or from an older version. This is the tested surface; the I/O
 * wrappers below just feed it `localStorage`.
 */
export function parseConsent(
  raw: string | null,
  _now: Date = new Date()
): ConsentState {
  if (!raw) return DEFAULT;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return DEFAULT;
  }
  if (!obj || typeof obj !== "object") return DEFAULT;
  const { version, analytics, at } = obj as Record<string, unknown>;
  const storedAt = typeof at === "string" ? at : null;
  // An explicit opt-out is a hard choice — it survives a disclosure-version
  // bump. Only the popup is re-shown (acknowledged resets); analytics stays off
  // until the visitor opts back in (popup Accept, or the Privacy Policy control).
  if (analytics === false) {
    return {
      acknowledged: version === CONSENT_VERSION,
      analytics: false,
      at: storedAt,
    };
  }
  // Anything else from an older version → re-prompt from the default.
  if (version !== CONSENT_VERSION) return DEFAULT;
  // A current record with analytics not opted out → acknowledged, analytics on.
  return { acknowledged: true, analytics: true, at: storedAt };
}

/* ── browser I/O ──────────────────────────────────────────────────────── */

/**
 * What to assume when `localStorage` can't be read (blocked site data, a
 * sandboxed frame). We can't tell a first-time visitor from one who opted out
 * on an earlier visit, so treat it as a possible opt-out: don't load analytics,
 * and don't nag with the notice.
 */
export const STORAGE_UNAVAILABLE: ConsentState = Object.freeze({
  acknowledged: true,
  analytics: false,
  at: null,
});

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

/** Returns whether the write actually landed (false if storage is blocked). */
function persist(analytics: boolean): boolean {
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        analytics,
        at: new Date().toISOString(),
      })
    );
    window.sessionStorage.removeItem(SESSION_DISMISS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opt in or out of analytics (from the popup, or the Privacy Policy control).
 * Returns whether the choice was actually saved — `false` means storage is
 * blocked and the change won't survive a reload.
 */
export function setAnalytics(allowed: boolean): boolean {
  if (typeof window === "undefined") return false;
  const saved = persist(allowed);
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  return saved;
}

/** Closed without choosing (the X / Esc) — hide for this session, re-show next visit. */
export function dismissForSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function wasDismissedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
