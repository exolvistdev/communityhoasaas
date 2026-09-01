"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signInPlatform(input: unknown): Promise<SignInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Enter your email and password" };

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
