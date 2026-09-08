import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/url";
import { sendEmail } from "@/lib/email";
import { esc } from "@/lib/notifications";

export type InviteLinkResult =
  | { ok: true; authId: string; actionLink: string | null }
  | { ok: false; error: string };

type InviteEmailOpts = { orgName: string; role?: string };

/** Invite-email HTML — inline-styled, no "turn off notifications" footer. */
export function inviteEmailHtml(opts: {
  orgName: string;
  fullName?: string;
  role?: string;
  actionLink: string;
}) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
  <h1 style="font-size:18px;margin:0 0 12px">You've been added to ${esc(opts.orgName)}</h1>
  <div style="font-size:14px;line-height:1.5;color:#374151">
    <p>Hi ${esc(opts.fullName || "there")}, ${esc(opts.orgName)} has added you to HOA Manager${
    opts.role ? ` as ${esc(opts.role)}` : ""
  }. Set a password to sign in:</p>
  </div>
  <p style="margin:20px 0 8px">
    <a href="${opts.actionLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px">Set your password</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
    This link works for about a day — ask your HOA admin to resend it if it stops working.
    If you weren't expecting this, you can ignore this email.
  </p>
</div>`;
}

async function sendInviteEmail(
  email: string,
  actionLink: string | null,
  opts?: InviteEmailOpts
) {
  if (!opts?.orgName || !actionLink) return;
  await sendEmail({
    to: email,
    subject: `${opts.orgName} invited you to HOA Manager`,
    html: inviteEmailHtml({
      orgName: opts.orgName,
      role: opts.role,
      actionLink,
    }),
  }).catch(() => {});
}

/**
 * Create (or re-issue) a Supabase invite for `email` and return the action link.
 * The link lands on /accept-invite where the person sets a password.
 * When `opts.orgName` is given, also emails the link via Resend (best-effort —
 * no-op without RESEND_API_KEY). The caller still gets the link to hand-deliver.
 */
export async function generateInviteLink(
  email: string,
  fullName?: string,
  opts?: InviteEmailOpts
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
    const actionLink = mag.properties?.action_link ?? null;
    await sendInviteEmail(email, actionLink, opts);
    return { ok: true, authId: mag.user.id, actionLink };
  }

  const actionLink = data.properties?.action_link ?? null;
  await sendInviteEmail(email, actionLink, opts);

  return {
    ok: true,
    authId: data.user.id,
    actionLink,
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
