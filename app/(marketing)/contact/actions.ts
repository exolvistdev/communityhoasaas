"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/email";
import { esc } from "@/lib/notifications";

type Field = "name" | "email" | "hoaName";

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; field?: Field };

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  hoaName: z.string().trim().min(2, "Enter your HOA or community name").max(160),
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

  const { name, email, hoaName, phone, message, company } = parsed.data;

  // Bot: pretend it worked, do nothing.
  if (company && company.trim()) return { ok: true };

  try {
    await prisma.lead.create({
      data: {
        name,
        email,
        hoaName,
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
    const rows = [
      ["Name", name],
      ["Email", email],
      ["HOA / community", hoaName],
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
