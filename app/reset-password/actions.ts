"use server";

import { createClient } from "@/lib/supabase/server";
import { strongPasswordSchema } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Set the current user's password, enforcing the strong-password rule
 * server-side. Used by accept-invite and reset-password (SetPasswordForm), and
 * by the logged-in account-settings change-password form, so a direct API call
 * can't bypass the client-side checklist. The recovery / invite / normal
 * session is already on the request cookies by the time this runs.
 */
export async function setOwnPassword(password: unknown): Promise<Result> {
  const parsed = strongPasswordSchema.safeParse(password);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      ok: false,
      error: "Your link has expired. Ask for a new one.",
    };

  // A valid session is already required, so this isn't a guessing vector —
  // just a cap on a hijacked-session or buggy-client retry loop hammering
  // Supabase's updateUser, matching the other hardened auth surfaces.
  const limited = await rateLimit("set-password", {
    max: 5,
    windowMs: 15 * 60_000,
    extra: user.id,
  });
  if (!limited.ok)
    return { ok: false, error: "Too many attempts — please try again later." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
