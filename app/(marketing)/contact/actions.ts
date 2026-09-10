"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/email";
import { esc } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { monthlyEstimate } from "@/lib/pricing";
import { peso } from "@/lib/format";

type Field = "name" | "email" | "hoaName";

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; field?: Field };

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  hoaName: z.string().trim().min(2, "Enter your HOA or community name").max(160),
  // Optional, best-effort — a bad value is dropped, never blocks the lead.
  propertyCount: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().max(1_000_000).optional().catch(undefined)
  ),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — real users never see or fill this.
  company: z.string().optional(),
});

const FIELDS: Field[] = ["name", "email", "hoaName"];

export async function submitLead(input: unknown): Promise<ContactResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path[0];
    return {
      ok: false,
      error: issue.message,
      field: FIELDS.includes(path as Field) ? (path as Field) : undefined,
    };
  }

  const { name, email, hoaName, propertyCount, phone, message, company } =
    parsed.data;

  // Bot: pretend it worked, do nothing.
  if (company && company.trim()) return { ok: true };

  // Cap the lead form so it can't be used to spam the table / inbox.
  const limited = await rateLimit("lead", { max: 4, windowMs: 60 * 60_000 });
  if (!limited.ok) return { ok: true }; // same success shape a bot would see

  try {
    await prisma.lead.create({
      data: {
        name,
        email,
        hoaName,
        propertyCount: propertyCount ?? null,
        phone: phone || null,
        message: message || null,
      },
    });
  } catch {
    return {
      ok: false,
      error: "Something went wrong — please try again or email us directly.",
    };
  }

  const to = process.env.CONTACT_INBOX;
  if (to) {
    const est = propertyCount ? monthlyEstimate(propertyCount) : null;
    const rows = [
      ["Name", name],
      ["Email", email],
      ["HOA / community", hoaName],
      est ? ["Properties", String(est.count)] : null,
      est
        ? [
            "Est. monthly",
            `${peso(est.total, { cents: false })} (at ${peso(est.rate, {
              cents: false,
            })}/property)`,
          ]
        : null,
      phone ? ["Phone", phone] : null,
      message ? ["Notes", message] : null,
    ].filter(Boolean) as [string, string][];
    const bodyHtml = rows
      .map(
        ([k, v]) =>
          `<p style="margin:4px 0"><strong>${esc(k)}:</strong> ${esc(v)}</p>`
      )
      .join("");
    await sendEmail({
      to,
      subject: `Demo request — ${hoaName}`,
      html: emailShell({
        heading: "New demo request",
        bodyHtml,
        ctaHref: "/",
        ctaLabel: "Open HOA Manager",
      }),
    }).catch(() => {});
  }

  return { ok: true };
}
