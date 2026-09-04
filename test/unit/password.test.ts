import { describe, it, expect } from "vitest";
import {
  PASSWORD_RULES,
  isStrongPassword,
  strongPasswordSchema,
} from "@/lib/password";

describe("isStrongPassword", () => {
  it("passes a password meeting every rule", () => {
    expect(isStrongPassword("Aa1!aaaaaa")).toBe(true); // exactly 10 chars
  });

  it("fails on length alone (9 chars)", () => {
    expect(isStrongPassword("Aa1!aaaaa")).toBe(false);
  });

  it("fails without an uppercase letter", () => {
    expect(isStrongPassword("aa1!aaaaaa")).toBe(false);
  });

  it("fails without a lowercase letter", () => {
    expect(isStrongPassword("AA1!AAAAAA")).toBe(false);
  });

  it("fails without a number", () => {
    expect(isStrongPassword("Aa!aaaaaaa")).toBe(false);
  });

  it("fails without a special character", () => {
    expect(isStrongPassword("Aa1aaaaaaa")).toBe(false);
  });

  it("accepts every listed special character", () => {
    for (const ch of "!@#$%^&*") {
      expect(isStrongPassword(`Aa1aaaaaa${ch}`)).toBe(true);
    }
  });

  it("rejects an empty password", () => {
    expect(isStrongPassword("")).toBe(false);
  });
});

describe("PASSWORD_RULES", () => {
  it("has exactly the four checklist rows", () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
      "length",
      "case",
      "number",
      "special",
    ]);
  });

  it("every rule agrees with isStrongPassword on a fully-valid password", () => {
    const pw = "Aa1!aaaaaa";
    expect(PASSWORD_RULES.every((r) => r.test(pw))).toBe(isStrongPassword(pw));
  });
});

describe("strongPasswordSchema", () => {
  it("accepts a strong password", () => {
    expect(strongPasswordSchema.safeParse("Aa1!aaaaaa").success).toBe(true);
  });

  it("reports the length issue first for a too-short password", () => {
    const res = strongPasswordSchema.safeParse("Aa1!aaa");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/10 characters/);
  });

  it("rejects a password missing a special character", () => {
    const res = strongPasswordSchema.safeParse("Aa1aaaaaaa");
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error.issues.some((i) => /special character/.test(i.message))).toBe(
        true
      );
  });
});
