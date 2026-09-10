"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email() });

/**
 * Send a password-reset email. Rate-limited (per IP and per address) so the
 * endpoint can't be used to bomb someone's inbox. Always resolves `ok` — the
 * page shows the same "if that email has an account…" message regardless.
 */
export async function requestPasswordReset(input: unknown): Promise<{ ok: true }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: true };
  const email = parsed.data.email.toLowerCase();

  const byIp = await rateLimit("password-reset", { max: 5, windowMs: 15 * 60_000 });
  const byEmail = await rateLimit("password-reset", {
    max: 3,
    windowMs: 60 * 60_000,
    extra: email,
  });
  if (!byIp.ok || !byEmail.ok) return { ok: true };

  const origin =
    headers().get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const supabase = createClient();
  await supabase.auth
    .resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/reset-password`,
    })
    .catch(() => {});

  return { ok: true };
}
