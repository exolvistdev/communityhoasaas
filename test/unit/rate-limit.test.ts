import { describe, it, expect } from "vitest";
import { ipFromHeaders } from "@/lib/rate-limit";

function h(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("ipFromHeaders", () => {
  it("prefers x-vercel-forwarded-for over everything else", () => {
    expect(
      ipFromHeaders(
        h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })
      )
    ).toBe("9.9.9.9");
  });

  it("takes the LAST hop of x-forwarded-for, not the first", () => {
    // The first entry is client-suppliable; only the edge's own appended
    // hop (the last one) can't be spoofed per-request.
    expect(
      ipFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }))
    ).toBe("3.3.3.3");
  });

  it("ignores empty/whitespace segments (e.g. a trailing comma)", () => {
    expect(ipFromHeaders(h({ "x-forwarded-for": "1.2.3.4, " }))).toBe(
      "1.2.3.4"
    );
    expect(ipFromHeaders(h({ "x-forwarded-for": "1.2.3.4,," }))).toBe(
      "1.2.3.4"
    );
  });

  it("never falls back to x-real-ip", () => {
    // Nothing in this app's deployment sets/strips x-real-ip, so trusting it
    // would just reopen the spoofable-header bypass under a different name.
    expect(ipFromHeaders(h({ "x-real-ip": "1.2.3.4" }))).toBe("unknown");
  });

  it("returns \"unknown\" with no usable header at all", () => {
    expect(ipFromHeaders(h({}))).toBe("unknown");
  });
});
