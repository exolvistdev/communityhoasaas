import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/url";
import { sendEmail } from "@/lib/email";
import { esc } from "@/lib/notifications";

export type InviteLinkResult =
  | { ok: true; authId: string; actionLink: string | null }
  | { ok: false; error: string };

/**
 * Case-insensitive `User` lookup by email, shared by every invite path
 * (`inviteMember`, `inviteHomeowner`) so the dedup/ordering rule can't drift
 * between them. Case-insensitive because `email` is lowercased by the
 * calling schema going forward, but a row written before that normalization
 * existed could still be stored mixed-case. `orderBy` makes the pick
 * deterministic if more than one such stale duplicate ever exists for the
 * same address — there's no DB-level case-insensitive uniqueness constraint
 * — preferring the oldest, most-likely-authoritative row.
 */
export function findUserByEmailInsensitive(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
}

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
 * When `opts.orgName` is given, also emails the link via Postmark (best-effort —
 * no-op without POSTMARK_SERVER_TOKEN). The caller still gets the link to
 * hand-deliver.
 */
export async function generateInviteLink(
  email: string,
  fullName?: string,
  opts?: InviteEmailOpts
): Promise<InviteLinkResult> {
  // A platform operator belongs to no org, so a caller's own "does a local
  // User already exist" pre-check can never see them — reject here, in the
  // one function every invite path funnels through, rather than trusting
  // every current and future caller to duplicate this check itself.
  const platformAdmin = await prisma.platformAdmin.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (platformAdmin) {
    return { ok: false, error: "Couldn't send an invite to that address." };
  }

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
    // Most commonly: `email` already has a Supabase auth account (its own
    // account-enumeration risk in the raw Supabase error text, hence the
    // generic message). This must NEVER fall back to a magic link — a
    // magic link is a working login for whatever account already owns that
    // address, and every caller of this function only reaches this branch
    // *after* its own "does a local User already exist for this email"
    // check has already missed. An address can have a Supabase auth account
    // with no local `User` row for entirely legitimate reasons (a
    // `PlatformAdmin` — which by design belongs to no org — or a
    // previously-removed member whose Supabase account failed to delete),
    // and handing back a login link for either case to whoever typed that
    // email into an invite form is a full account takeover.
    return { ok: false, error: "Couldn't send an invite to that address." };
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
