import { describe, it, expect } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath", () => {
  it("allows an ordinary relative path", () => {
    expect(safeRelativePath("/billing")).toBe("/billing");
    expect(safeRelativePath("/portal/water?tab=history")).toBe(
      "/portal/water?tab=history"
    );
  });

  it("falls back to / for a missing or non-relative value", () => {
    expect(safeRelativePath(null)).toBe("/");
    expect(safeRelativePath(undefined)).toBe("/");
    expect(safeRelativePath("")).toBe("/");
    expect(safeRelativePath("billing")).toBe("/");
    expect(safeRelativePath("https://evil.com")).toBe("/");
  });

  it("blocks a protocol-relative URL", () => {
    expect(safeRelativePath("//evil.com")).toBe("/");
    expect(safeRelativePath("/\\evil.com")).toBe("/");
  });

  it("blocks the tab/CR bypass — a WHATWG URL parser strips those before navigating", () => {
    expect(safeRelativePath("/\t/evil.com")).toBe("/");
    expect(safeRelativePath("/\r/evil.com")).toBe("/");
    expect(safeRelativePath("/\n/evil.com")).toBe("/");
  });
});
