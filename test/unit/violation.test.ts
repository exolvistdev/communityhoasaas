import { describe, it, expect } from "vitest";
import {
  nextNoticeNumber,
  canTransitionViolation,
  isViolationCategory,
  VIOLATION_CATEGORY_LABEL,
} from "@/lib/violation";

describe("nextNoticeNumber", () => {
  it("starts at 1", () => {
    expect(nextNoticeNumber([])).toBe(1);
  });
  it("is one past the highest existing number", () => {
    expect(nextNoticeNumber([{ noticeNumber: 1 }, { noticeNumber: 2 }])).toBe(3);
    expect(nextNoticeNumber([{ noticeNumber: 3 }])).toBe(4);
  });
  it("tolerates gaps and out-of-order input", () => {
    expect(nextNoticeNumber([{ noticeNumber: 3 }, { noticeNumber: 1 }])).toBe(4);
  });
});

describe("canTransitionViolation", () => {
  it("OPEN can be cured, dismissed or appealed", () => {
    expect(canTransitionViolation("OPEN", "CURED")).toBe(true);
    expect(canTransitionViolation("OPEN", "DISMISSED")).toBe(true);
    expect(canTransitionViolation("OPEN", "APPEALED")).toBe(true);
  });
  it("APPEALED can go back to open or be resolved", () => {
    expect(canTransitionViolation("APPEALED", "OPEN")).toBe(true);
    expect(canTransitionViolation("APPEALED", "DISMISSED")).toBe(true);
  });
  it("a resolved violation can only be reopened", () => {
    expect(canTransitionViolation("CURED", "OPEN")).toBe(true);
    expect(canTransitionViolation("CURED", "DISMISSED")).toBe(false);
    expect(canTransitionViolation("DISMISSED", "APPEALED")).toBe(false);
  });
  it("a no-op transition is not allowed", () => {
    expect(canTransitionViolation("OPEN", "OPEN")).toBe(false);
  });
});

describe("isViolationCategory", () => {
  it("accepts a known enum value", () => {
    expect(isViolationCategory("PARKING")).toBe(true);
    expect(Object.keys(VIOLATION_CATEGORY_LABEL)).toContain("PARKING");
  });
  it("rejects anything else", () => {
    expect(isViolationCategory("parking")).toBe(false);
    expect(isViolationCategory(3)).toBe(false);
  });
});
