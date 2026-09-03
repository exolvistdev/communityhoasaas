import { describe, it, expect } from "vitest";
import {
  filterByAgingBucket,
  pickMonth,
  AGING_BUCKET_LABEL,
} from "@/lib/report-filter";
import type { Aging } from "@/lib/soa";

const aging = (o: Partial<Aging>): Aging => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
  ...o,
});

describe("filterByAgingBucket", () => {
  const rows = [
    { id: "a", aging: aging({ current: 100, d90plus: 50 }) },
    { id: "b", aging: aging({ d1_30: 200 }) },
    { id: "c", aging: aging({ d90plus: 0.001 }) }, // sub-cent — treated as empty
  ];

  it("returns everything when no bucket is selected", () => {
    expect(filterByAgingBucket(rows, null)).toHaveLength(3);
  });

  it("keeps only rows carrying a balance in the bucket", () => {
    expect(filterByAgingBucket(rows, "d90plus").map((r) => r.id)).toEqual(["a"]);
    expect(filterByAgingBucket(rows, "d1_30").map((r) => r.id)).toEqual(["b"]);
    expect(filterByAgingBucket(rows, "d31_60")).toEqual([]);
  });

  it("has a label for every bucket key", () => {
    for (const k of Object.keys(rows[0].aging) as (keyof Aging)[])
      expect(AGING_BUCKET_LABEL[k]).toBeTruthy();
  });
});

describe("pickMonth", () => {
  const series = [
    { key: "2026-07", label: "Jul '26", cash: 100 },
    { key: "2026-08", label: "Aug '26", cash: 250 },
  ];

  it("is null when nothing is selected or the key is unknown", () => {
    expect(pickMonth(series, null)).toBeNull();
    expect(pickMonth(series, "2026-01")).toBeNull();
  });

  it("returns the matching row, keeping its shape", () => {
    const hit = pickMonth(series, "2026-08");
    expect(hit?.label).toBe("Aug '26");
    expect(hit?.cash).toBe(250);
  });
});
