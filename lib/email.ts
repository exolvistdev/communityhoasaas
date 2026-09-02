/**
 * Origin for links inside emails. Unlike `siteOrigin()` this never touches
 * `headers()` — email is often sent from a detached promise where the request
 * scope is already gone. Set NEXT_PUBLIC_SITE_URL in production.
 */
function emailOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Send a transactional email via Resend. Best-effort — never throws, and
 * no-ops (with a console line) when RESEND_API_KEY is unset, so the app runs
 * fine in dev without an email provider. Mirrors the invite flow's behaviour.
 */
export async function sendEmail(msg: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const to = Array.isArray(msg.to) ? msg.to : [msg.to];
  if (!key) {
    console.info("[email skipped]", msg.subject, "→", to.join(", "));
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "HOA SaaS <onboarding@resend.dev>",
        to,
        subject: msg.subject,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      console.error("[email failed]", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[email error]", (e as Error).message);
  }
}

/** Minimal, inline-styled HTML wrapper with a single call-to-action button. */
export function emailShell(opts: {
  heading: string;
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const href = opts.ctaHref.startsWith("http")
    ? opts.ctaHref
    : `${emailOrigin()}${opts.ctaHref}`;
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
  <h1 style="font-size:18px;margin:0 0 12px">${opts.heading}</h1>
  <div style="font-size:14px;line-height:1.5;color:#374151">${opts.bodyHtml}</div>
  <p style="margin:20px 0 8px">
    <a href="${href}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px">${opts.ctaLabel}</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
    You can turn these emails off in your
    <a href="${emailOrigin()}/account" style="color:#9ca3af">account settings</a>.
  </p>
</div>`;
}
