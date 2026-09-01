import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/url";

export type InviteLinkResult =
  | { ok: true; authId: string; actionLink: string | null }
  | { ok: false; error: string };

/**
 * Create (or re-issue) a Supabase invite for `email` and return the action link.
 * The link lands on /accept-invite where the person sets a password.
 * Also fires the built-in invite email best-effort (works only if SMTP is set).
 */
export async function generateInviteLink(
  email: string,
  fullName?: string
): Promise<InviteLinkResult> {
  const admin = createAdminClient();
  const redirectTo = `${siteOrigin()}/accept-invite`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error || !data.user) {
    // user may already exist as a Supabase auth user — fall back to a magic link
    const { data: mag, error: magErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (magErr || !mag.user)
      return {
        ok: false,
        error: error?.message ?? magErr?.message ?? "Could not create invite",
      };
    return {
      ok: true,
      authId: mag.user.id,
      actionLink: mag.properties?.action_link ?? null,
    };
  }

  // best-effort email (no-op without SMTP)
  admin.auth.admin.inviteUserByEmail(email, { redirectTo }).catch(() => {});

  return {
    ok: true,
    authId: data.user.id,
    actionLink: data.properties?.action_link ?? null,
  };
}

export type RecoveryLinkResult =
  | { ok: true; actionLink: string | null }
  | { ok: false; error: string };

/**
 * Generate a password-recovery link for an existing account, without relying
 * on Supabase sending the email (no SMTP dependency) — the caller shows the
 * link for the admin to copy/send.
 */
export async function generateRecoveryLink(
  email: string
): Promise<RecoveryLinkResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteOrigin()}/reset-password` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, actionLink: data.properties?.action_link ?? null };
}
