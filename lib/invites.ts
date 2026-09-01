import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  return host ? `http://${host}` : "http://localhost:3000";
}

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
  admin.auth.admin
    .inviteUserByEmail(email, { redirectTo })
    .catch(() => {});

  return {
    ok: true,
    authId: data.user.id,
    actionLink: data.properties?.action_link ?? null,
  };
}
