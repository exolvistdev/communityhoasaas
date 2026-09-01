"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(input: unknown): Promise<SignInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter your email and password" };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Incorrect email or password" };

  return { ok: true };
}
