// Cookie-consent state for the public marketing site. Client-safe — no
// top-level window access, so it can be imported from server components too.

export type ConsentCategory = "necessary" | "analytics";

export type ConsentState = {
  /** the visitor has made an explicit Accept / Decline / Save choice */
  decided: boolean;
  /** non-essential analytics allowed */
  analytics: boolean;
  /** ISO timestamp of the decision, or null */
  at: string | null;
};

const UNDECIDED: ConsentState = { decided: false, analytics: false, at: null };

export const CONSENT_KEY = "hoa_cookie_consent";
export const SESSION_DISMISS_KEY = "hoa_cookie_dismissed";
/** Bump when the cookie disclosure materially changes — forces a re-prompt. */
export const CONSENT_VERSION = 1;
/** Re-ask after this long even if nothing changed. */
export const CONSENT_TTL_DAYS = 180;

export const CONSENT_CHANGE_EVENT = "hoa:consent-change";
export const CONSENT_OPEN_EVENT = "hoa:consent-open";

/**
 * Pure: turn a stored consent string into state. Undecided when it's missing,
 * malformed, from an older version, or past the TTL. This is the tested surface;
 * the I/O wrappers below just feed it `localStorage`.
 */
export function parseConsent(
  raw: string | null,
  now: Date = new Date()
): ConsentState {
  if (!raw) return UNDECIDED;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return UNDECIDED;
  }
  if (!obj || typeof obj !== "object") return UNDECIDED;
  const { version, analytics, at } = obj as Record<string, unknown>;
  if (version !== CONSENT_VERSION) return UNDECIDED;
  if (typeof at !== "string") return UNDECIDED;
  const ageMs = now.getTime() - new Date(at).getTime();
  if (!Number.isFinite(ageMs) || ageMs > CONSENT_TTL_DAYS * 86_400_000)
    return UNDECIDED;
  return { decided: true, analytics: analytics === true, at };
}

/* ── browser I/O (all guarded, fail-safe to UNDECIDED) ─────────────────── */

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return UNDECIDED;
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return UNDECIDED;
  }
}

export function writeConsent(analytics: boolean): void {
  if (typeof window === "undefined") return;
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
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** Closed without choosing — hide for this browsing session, re-ask next visit. */
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

/** Re-open the banner (from the footer "Cookie settings" control). */
export function openPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
