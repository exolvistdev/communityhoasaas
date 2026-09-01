"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteLink } from "@/lib/invites";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function guard(): Promise<{ ok: false; error: string } | null> {
  return denyUnless("team:write");
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  fullName: z.string().trim().min(2, "Enter their name"),
  role: z.enum(["ADMIN", "TREASURER", "BOARD_MEMBER", "GUARD"]),
});

export async function inviteMember(
  input: unknown
): Promise<Result<{ actionLink: string | null }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { email, fullName, role } = parsed.data;

  const { org } = await getCurrentOrgContext();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return { ok: false, error: "Someone with that email is already on the team" };

  const invite = await generateInviteLink(email, fullName);
  if (!invite.ok) return invite;

  await prisma.user.create({
    data: {
      orgId: org.id,
      authId: invite.authId,
      email,
      fullName,
      role,
    },
  });

  revalidatePath("/team");
  return { ok: true, actionLink: invite.actionLink };
}

const roleSchema = z.enum([
  "ADMIN",
  "TREASURER",
  "BOARD_MEMBER",
  "GUARD",
  "HOMEOWNER",
]);

export async function updateMemberRole(
  userId: string,
  role: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, error: "Invalid role" };

  const { org, user: me } = await getCurrentOrgContext();
  const target = await prisma.user.findFirst({
    where: { id: userId, orgId: org.id },
  });
  if (!target) return { ok: false, error: "Member not found" };

  if (
    target.role === "ADMIN" &&
    parsedRole.data !== "ADMIN" &&
    (await countAdmins(org.id)) <= 1
  )
    return { ok: false, error: "The HOA needs at least one admin" };

  if (target.id === me.id && parsedRole.data !== "ADMIN")
    return { ok: false, error: "You can't remove your own admin access" };

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsedRole.data },
  });
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org, user: me } = await getCurrentOrgContext();
  if (userId === me.id)
    return { ok: false, error: "You can't remove yourself" };

  const target = await prisma.user.findFirst({
    where: { id: userId, orgId: org.id },
    include: { homeowner: true },
  });
  if (!target) return { ok: false, error: "Member not found" };
  if (target.role === "ADMIN" && (await countAdmins(org.id)) <= 1)
    return { ok: false, error: "The HOA needs at least one admin" };

  if (target.homeowner)
    await prisma.homeowner.update({
      where: { id: target.homeowner.id },
      data: { userId: null },
    });
  await prisma.user.delete({ where: { id: userId } });

  if (target.authId) {
    await createAdminClient()
      .auth.admin.deleteUser(target.authId)
      .catch(() => {});
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function resendInvite(
  userId: string
): Promise<Result<{ actionLink: string | null }>> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const target = await prisma.user.findFirst({
    where: { id: userId, orgId: org.id },
  });
  if (!target) return { ok: false, error: "Member not found" };
  if (target.acceptedAt)
    return { ok: false, error: "They've already joined" };

  const invite = await generateInviteLink(target.email, target.fullName);
  if (!invite.ok) return invite;
  return { ok: true, actionLink: invite.actionLink };
}

function countAdmins(orgId: string) {
  return prisma.user.count({ where: { orgId, role: "ADMIN" } });
}
