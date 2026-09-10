"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(input: unknown): Promise<SignInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter your email and password" };

  // 10 attempts / 5 min per IP, and 5 / 5 min per email — throttles credential
  // stuffing without punishing a legitimate fat-fingered login.
  const byIp = await rateLimit("login", { max: 10, windowMs: 5 * 60_000 });
  const byEmail = await rateLimit("login", {
    max: 5,
    windowMs: 5 * 60_000,
    extra: parsed.data.email.toLowerCase(),
  });
  if (!byIp.ok || !byEmail.ok)
    return {
      ok: false,
      error: "Too many attempts. Wait a few minutes and try again.",
    };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Incorrect email or password" };

  return { ok: true };
}
