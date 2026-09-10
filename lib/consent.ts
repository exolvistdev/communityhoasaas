// Analytics-consent state for the public marketing site. Client-safe — no
// top-level window access, so it can be imported from server components too.
//
// Model: OPT-OUT. Vercel Web Analytics is cookieless (a daily-rotating one-way
// hash, no persistent id, no cross-site tracking, no PII stored), so it runs by
// default. A visitor can opt out from the notice or the footer "Cookie settings"
// control, and that choice is sticky.

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
 * Bump when the disclosure materially changes: it re-shows the notice for
 * everyone (clears `acknowledged`). An explicit opt-out is preserved across the
 * bump — see `parseConsent`. TODO when first bumping this: make the notice's
 * second button an explicit opt-*in* when the visitor is already opted out,
 * otherwise "Got it" silently keeps them out.
 */
export const CONSENT_VERSION = 1;

export const CONSENT_CHANGE_EVENT = "hoa:consent-change";
export const CONSENT_OPEN_EVENT = "hoa:consent-open";

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
  // bump. Only the notice is re-shown (acknowledged resets); analytics stays
  // off until the visitor changes it from "Cookie settings".
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

function persist(analytics: boolean): void {
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
  } catch {
    /* storage blocked — nothing else we can do */
  }
}

/** Opt in or out of analytics (from the notice or the "Cookie settings" panel). */
export function setAnalytics(allowed: boolean): void {
  if (typeof window === "undefined") return;
  persist(allowed);
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/**
 * Record that the visitor dismissed the notice without opting out — keeps
 * analytics at its current value (default on) and stops the notice returning.
 */
export function acknowledgeNotice(): void {
  if (typeof window === "undefined") return;
  persist(readConsent().analytics);
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
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

/** Re-open the notice (from the footer "Cookie settings" control). */
export function openPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
