"use server";

import { createClient } from "@/lib/supabase/server";
import { strongPasswordSchema } from "@/lib/password";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Set the current user's password, enforcing the strong-password rule
 * server-side. Used by accept-invite and reset-password (SetPasswordForm) so a
 * direct API call can't bypass the client-side checklist. The recovery / invite
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

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
