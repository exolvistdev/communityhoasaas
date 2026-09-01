"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";

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
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
});

export async function updateHomeownerContact(input: unknown): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getCurrentOrgContext();
  const homeowner = await prisma.homeowner.findFirst({
    where: { userId: user.id },
  });
  if (!homeowner) return { ok: false, error: "No unit linked to your account" };

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
