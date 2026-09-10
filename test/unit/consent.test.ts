import { describe, it, expect } from "vitest";
import { parseConsent, CONSENT_VERSION } from "@/lib/consent";

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

  it("re-shows the notice (default state) when the stored version is old", () => {
    const raw = store({ version: 0, analytics: false, at: NOW.toISOString() });
    expect(parseConsent(raw, NOW)).toEqual({
      acknowledged: false,
      analytics: true,
      at: null,
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
