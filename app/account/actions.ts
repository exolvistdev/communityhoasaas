"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { CATEGORIES, staffRecipients, esc } from "@/lib/notifications";
import { sendEmail, emailShell } from "@/lib/email";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

function revalidateShells() {
  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  revalidatePath("/guard");
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name"),
});

export async function updateProfile(input: unknown): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getCurrentOrgContext();
  await prisma.user.update({
    where: { id: user.id },
    data: { fullName: parsed.data.fullName },
  });

  revalidateShells();
  return { ok: true };
}

const contactSchema = z.object({
  homeownerId: z.string().uuid(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
});

export async function updateHomeownerContact(input: unknown): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getCurrentOrgContext();
  const homeowner = await prisma.homeowner.findFirst({
    where: { id: parsed.data.homeownerId, userId: user.id },
  });
  if (!homeowner) return { ok: false, error: "That unit isn't linked to your account" };

  await prisma.homeowner.update({
    where: { id: homeowner.id },
    data: {
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
    },
  });

  revalidatePath("/account");
  revalidatePath(`/properties/${homeowner.propertyId}`);
  return { ok: true };
}

const channelSchema = z.object({ email: z.boolean(), inApp: z.boolean() });
const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];
const prefsSchema = z.object({
  emailNotifications: z.boolean(),
  prefs: z.record(z.enum(categoryKeys), channelSchema),
});

export async function updateNotificationPrefs(input: unknown): Promise<Result> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getCurrentOrgContext();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailNotifications: parsed.data.emailNotifications,
      notificationPrefs: parsed.data.prefs,
    },
  });
  revalidateShells();
  return { ok: true };
}

/* ───────────────────────── data-privacy (RA 10173) ───────────────── */

export async function requestAccountDeletion(reason?: unknown): Promise<Result> {
  const parsed = z
    .string()
    .trim()
    .max(1000)
    .optional()
    .safeParse(typeof reason === "string" ? reason : undefined);
  const reasonText = parsed.success ? parsed.data : undefined;

  const { org, user } = await getCurrentOrgContext();

  const existing = await prisma.dataRequest.findFirst({
    where: { userId: user.id, type: "DELETION", status: "PENDING" },
  });
  if (existing)
    return { ok: false, error: "You already have a deletion request pending." };

  await prisma.dataRequest.create({
    data: {
      orgId: org.id,
      userId: user.id,
      type: "DELETION",
      reason: reasonText || null,
    },
  });

  const admins = (await staffRecipients(org.id, ["ADMIN"])).filter(
    (a) => a.emailNotifications && !a.deactivatedAt
  );
  if (admins.length) {
    const html = emailShell({
      heading: "A resident requested account deletion",
      bodyHtml: `<p><strong>${esc(user.fullName)}</strong> (${esc(
        user.email
      )}) asked for their account and personal data to be deleted.</p>${
        reasonText ? `<p>Reason: ${esc(reasonText)}</p>` : ""
      }<p>Review it in the privacy requests queue.</p>`,
      ctaHref: "/data-requests",
      ctaLabel: "Open privacy requests",
    });
    await Promise.all(
      admins.map((a) =>
        sendEmail({ to: a.email, subject: "Account deletion request", html })
      )
    ).catch(() => {});
  }

  revalidatePath("/account");
  revalidatePath("/data-requests");
  revalidatePath("/dashboard");
  await logAudit({ action: "privacy.deletion_requested", target: user.fullName });
  return { ok: true };
}

export async function cancelDataRequest(id: string): Promise<Result> {
  const { user } = await getCurrentOrgContext();
  const req = await prisma.dataRequest.findFirst({
    where: { id, userId: user.id, status: "PENDING" },
  });
  if (!req) return { ok: false, error: "Request not found" };

  await prisma.dataRequest.update({
    where: { id },
    data: { status: "CANCELLED", handledAt: new Date() },
  });
  revalidatePath("/account");
  revalidatePath("/data-requests");
  return { ok: true };
}
