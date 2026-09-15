"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimitByIpAndEmail } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/url";

const schema = z.object({ email: z.string().trim().email() });

/**
 * Send a password-reset email. Rate-limited (per IP and per address) so the
 * endpoint can't be used to bomb someone's inbox. Always resolves `ok` — the
 * page shows the same "if that email has an account…" message regardless.
 */
export async function requestPasswordReset(input: unknown): Promise<{ ok: true }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: true };

  const limited = await rateLimitByIpAndEmail("password-reset", {
    ipMax: 5,
    ipWindowMs: 15 * 60_000,
    emailMax: 3,
    emailWindowMs: 60 * 60_000,
    email: parsed.data.email,
  });
  if (!limited.ok) return { ok: true };

  const supabase = createClient();
  await supabase.auth
    .resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${siteOrigin()}/reset-password`,
    })
    .catch(() => {});

  return { ok: true };
}
