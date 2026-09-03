"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_ACCOUNTS } from "@/lib/ledger";

const step1Schema = z.object({
  orgName: z.string().trim().min(2, "Enter your HOA's name"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/,
      "3–32 chars, lowercase letters, numbers and hyphens only"
    ),
  fullName: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  waterSource: z.enum(["INTERNAL", "EXTERNAL_BULK", "EXTERNAL_DIRECT"], {
    errorMap: () => ({ message: "Choose how your subdivision gets water" }),
  }),
});

export type Step1Result =
  | { ok: true }
  | { ok: false; error: string; field?: string };

export async function createOrgAndAdmin(
  input: unknown
): Promise<Step1Result> {
  const parsed = step1Schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const { orgName, subdomain, fullName, email, password, waterSource } =
    parsed.data;

  const existing = await prisma.organization.findUnique({ where: { subdomain } });
  if (existing)
    return { ok: false, error: "That subdomain is taken", field: "subdomain" };

  const supabase = createClient();
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Create the auth user. Prefer the service-role path (email pre-confirmed);
  // fall back to public sign-up when no service-role key is configured.
  let authId: string;
  let rollbackAuthUser: (() => Promise<void>) | null = null;

  if (hasServiceRole) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user)
      return {
        ok: false,
        error: error?.message ?? "Could not create your account",
        field: "email",
      };
    authId = data.user.id;
    rollbackAuthUser = () =>
      admin.auth.admin.deleteUser(authId).then(() => {});
  } else {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error || !data.user)
      return {
        ok: false,
        error: error?.message ?? "Could not create your account",
        field: "email",
      };
    authId = data.user.id;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, subdomain, waterSource },
      });
      await tx.user.create({
        data: { orgId: org.id, authId, email, fullName, role: "ADMIN" },
      });
      await tx.account.createMany({
        data: SEED_ACCOUNTS.map((a) => ({ ...a, orgId: org.id })),
      });
    });
  } catch (e) {
    // roll back the orphaned auth user so the email can be retried
    if (rollbackAuthUser) await rollbackAuthUser().catch(() => {});
    return {
      ok: false,
      error: "Could not set up your HOA. Please try again.",
    };
  }

  // Ensure the browser has a session for step 2.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      return {
        ok: false,
        error:
          "Your HOA is set up. Confirm your email, then sign in to import properties.",
      };
    }
  }

  return { ok: true };
}
