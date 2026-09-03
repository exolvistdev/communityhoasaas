import { describe, it, expect } from "vitest";
import { parseBoardPackExtras } from "@/lib/reports";

describe("parseBoardPackExtras", () => {
  it("is empty for no param", () => {
    expect(parseBoardPackExtras(undefined)).toEqual([]);
  });

  it("accepts a repeated param (checkbox form)", () => {
    expect(parseBoardPackExtras(["late-fees", "homeowners"])).toEqual([
      "late-fees",
      "homeowners",
    ]);
  });

  it("accepts a comma-joined param", () => {
    expect(parseBoardPackExtras("vendor-spend,violations")).toEqual([
      "vendor-spend",
      "violations",
    ]);
  });

  it("drops unknown slugs and returns a stable order", () => {
    expect(parseBoardPackExtras(["homeowners", "bogus", "late-fees"])).toEqual([
      "late-fees",
      "homeowners",
    ]);
  });
});
