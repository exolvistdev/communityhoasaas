import { describe, it, expect, afterEach, vi } from "vitest";
import { parseReportRange } from "@/lib/reports";

describe("parseReportRange", () => {
  afterEach(() => vi.useRealTimers());

  it("parses YYYY-MM-DD as Asia/Manila day boundaries", () => {
    const r = parseReportRange({ from: "2026-03-01", to: "2026-03-31" });
    expect(r.fromYmd).toBe("2026-03-01");
    expect(r.toYmd).toBe("2026-03-31");
    // 2026-03-01 00:00 Manila == 2026-02-28 16:00 UTC
    expect(r.from.toISOString()).toBe("2026-02-28T16:00:00.000Z");
    // end of 2026-03-31 Manila == 2026-03-31 15:59:59.999 UTC
    expect(r.to.toISOString()).toBe("2026-03-31T15:59:59.999Z");
    expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
  });

  it("defaults to 1 January of the current year through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T04:00:00Z")); // noon in Manila
    const r = parseReportRange({});
    expect(r.fromYmd).toBe("2026-01-01");
    expect(r.toYmd).toBe("2026-07-15");
  });

  it("ignores a malformed date and falls back to the default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T04:00:00Z"));
    expect(parseReportRange({ from: "03/01/2026", to: "" }).fromYmd).toBe("2026-01-01");
  });
});
