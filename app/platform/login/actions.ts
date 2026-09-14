"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { rateLimitByIpAndEmail } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signInPlatform(input: unknown): Promise<SignInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Enter your email and password" };

  // 8 attempts / 5 min per IP, and 5 / 15 min per email-from-that-IP — same
  // shape as tenant login. Deliberately NOT a cross-IP per-account lockout:
  // that would let anyone who knows this account's email (the seed's
  // superadmin@hoasaas.ph is public) hold it saturated indefinitely for the
  // cost of one request every few minutes — see lib/rate-limit.ts.
  const limited = await rateLimitByIpAndEmail("platform-login", {
    ipMax: 8,
    ipWindowMs: 5 * 60_000,
    emailMax: 5,
    emailWindowMs: 15 * 60_000,
    email: parsed.data.email,
  });
  if (!limited.ok)
    return { ok: false, error: "Too many attempts. Wait a few minutes." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return { ok: false, error: "Incorrect email or password" };

  const admin = await prisma.platformAdmin.findUnique({
    where: { authId: data.user.id },
  });
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account isn't a platform admin" };
  }

  return { ok: true };
}
