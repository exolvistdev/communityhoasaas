import { describe, it, expect } from "vitest";
import { parseConsent, CONSENT_VERSION, CONSENT_TTL_DAYS } from "@/lib/consent";

const NOW = new Date("2026-09-10T00:00:00Z");
const store = (o: object) => JSON.stringify(o);
const fresh = (analytics: boolean) =>
  store({ version: CONSENT_VERSION, analytics, at: NOW.toISOString() });

describe("parseConsent", () => {
  it("is undecided for missing / empty / malformed input", () => {
    for (const raw of [null, "", "   ", "{not json", "[]", "null", "42"]) {
      expect(parseConsent(raw as string | null, NOW)).toEqual({
        decided: false,
        analytics: false,
        at: null,
      });
    }
  });

  it("reads a fresh accept", () => {
    expect(parseConsent(fresh(true), NOW)).toEqual({
      decided: true,
      analytics: true,
      at: NOW.toISOString(),
    });
  });

  it("reads a fresh decline as decided with analytics off", () => {
    expect(parseConsent(fresh(false), NOW)).toMatchObject({
      decided: true,
      analytics: false,
    });
  });

  it("re-prompts when the stored version is old (policy bumped)", () => {
    const raw = store({ version: 0, analytics: true, at: NOW.toISOString() });
    expect(parseConsent(raw, NOW).decided).toBe(false);
  });

  it("re-prompts once the decision is past the TTL", () => {
    const old = new Date(
      NOW.getTime() - (CONSENT_TTL_DAYS + 1) * 86_400_000
    ).toISOString();
    const raw = store({ version: CONSENT_VERSION, analytics: true, at: old });
    expect(parseConsent(raw, NOW).decided).toBe(false);

    // still inside the window → honoured
    const recent = new Date(
      NOW.getTime() - (CONSENT_TTL_DAYS - 1) * 86_400_000
    ).toISOString();
    expect(
      parseConsent(
        store({ version: CONSENT_VERSION, analytics: true, at: recent }),
        NOW
      ).decided
    ).toBe(true);
  });

  it("treats a bad timestamp as undecided", () => {
    const raw = store({ version: CONSENT_VERSION, analytics: true, at: "nope" });
    expect(parseConsent(raw, NOW).decided).toBe(false);
  });

  it("only true enables analytics", () => {
    const raw = store({ version: CONSENT_VERSION, analytics: "yes", at: NOW.toISOString() });
    expect(parseConsent(raw, NOW)).toMatchObject({ decided: true, analytics: false });
  });
});
