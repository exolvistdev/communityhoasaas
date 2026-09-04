import { z } from "zod";

// Shared strong-password rule for every password-creation surface: onboarding
// (new org admin), accept-invite / reset-password (SetPasswordForm), and
// account settings' change-password. Client components drive the real-time
// checklist off PASSWORD_RULES; app/onboarding/actions.ts mirrors the same
// rule server-side via strongPasswordSchema.

export type PasswordRule = {
  id: "length" | "case" | "number" | "special";
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_SPECIAL_CHARS = "!@#$%^&*";

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 10 characters", test: (pw) => pw.length >= 10 },
  {
    id: "case",
    label: "Upper & lowercase letters",
    test: (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw),
  },
  { id: "number", label: "One number", test: (pw) => /[0-9]/.test(pw) },
  {
    id: "special",
    label: "One special character (!@#$%^&*)",
    test: (pw) => /[!@#$%^&*]/.test(pw),
  },
];

export function isStrongPassword(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Use at least 10 characters, with upper & lowercase letters, a number, and a special character (!@#$%^&*).";

/** Server-side (Zod) mirror of PASSWORD_RULES, for form actions. */
export const strongPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(/[!@#$%^&*]/, "Include at least one special character (!@#$%^&*)");
