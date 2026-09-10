import { describe, it, expect } from "vitest";
import {
  parseConsent,
  readConsent,
  CONSENT_VERSION,
  STORAGE_UNAVAILABLE,
} from "@/lib/consent";

const NOW = new Date("2026-09-10T00:00:00Z");
const store = (o: object) => JSON.stringify(o);
const record = (analytics: unknown) =>
  store({ version: CONSENT_VERSION, analytics, at: NOW.toISOString() });

describe("parseConsent", () => {
  it("defaults to analytics-on / not-acknowledged for missing / empty / malformed input", () => {
    for (const raw of [null, "", "   ", "{not json", "[]", "null", "42"]) {
      expect(parseConsent(raw as string | null, NOW)).toEqual({
        acknowledged: false,
        analytics: true,
        at: null,
      });
    }
  });

  it("reads a stored opt-in as acknowledged with analytics on", () => {
    expect(parseConsent(record(true), NOW)).toEqual({
      acknowledged: true,
      analytics: true,
      at: NOW.toISOString(),
    });
  });

  it("reads a stored opt-out as acknowledged with analytics off", () => {
    expect(parseConsent(record(false), NOW)).toMatchObject({
      acknowledged: true,
      analytics: false,
    });
  });

  it("re-prompts from the default when an old-version record was not an opt-out", () => {
    const raw = store({ version: 0, analytics: true, at: NOW.toISOString() });
    expect(parseConsent(raw, NOW)).toEqual({
      acknowledged: false,
      analytics: true,
      at: null,
    });
  });

  it("keeps an explicit opt-out across a version bump, re-showing only the notice", () => {
    const raw = store({ version: 0, analytics: false, at: NOW.toISOString() });
    expect(parseConsent(raw, NOW)).toEqual({
      acknowledged: false,
      analytics: false,
      at: NOW.toISOString(),
    });
  });

  it("only an explicit false opts out — any other value keeps analytics on", () => {
    for (const v of ["yes", 0, 1, null, undefined]) {
      expect(parseConsent(record(v), NOW)).toMatchObject({
        acknowledged: true,
        analytics: true,
      });
    }
  });

  it("tolerates a missing / non-string timestamp", () => {
    const raw = store({ version: CONSENT_VERSION, analytics: false });
    expect(parseConsent(raw, NOW)).toEqual({
      acknowledged: true,
      analytics: false,
      at: null,
    });
  });
});

describe("readConsent", () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, "window");
  const stubWindow = (localStorage: unknown) => {
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  };
  const restore = () => {
    if (orig) Object.defineProperty(globalThis, "window", orig);
    else delete (globalThis as { window?: unknown }).window;
  };

  it("treats unreadable storage as a possible opt-out (no tracking, no notice)", () => {
    stubWindow({
      getItem() {
        throw new Error("blocked");
      },
    });
    try {
      expect(readConsent()).toEqual(STORAGE_UNAVAILABLE);
      expect(STORAGE_UNAVAILABLE.analytics).toBe(false);
    } finally {
      restore();
    }
  });

  it("parses a stored opt-out from live storage", () => {
    stubWindow({
      getItem: () => store({ version: CONSENT_VERSION, analytics: false, at: NOW.toISOString() }),
    });
    try {
      expect(readConsent()).toMatchObject({ acknowledged: true, analytics: false });
    } finally {
      restore();
    }
  });
});
