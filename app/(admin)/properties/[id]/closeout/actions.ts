"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { executeCloseout } from "@/lib/closeout";
import { inviteHomeowner } from "../actions";

type Result = { ok: true; inviteLink: string | null } | { ok: false; error: string };

const schema = z.object({
  settlement: z.enum(["SETTLED", "WRITTEN_OFF", "CARRIED_TO_NEW_OWNER"]),
  vacated: z.boolean(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an effective date"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  newOwner: z
    .object({
      fullName: z.string().trim().max(120),
      role: z.enum(["OWNER", "CO_OWNER", "RENTER"]),
      email: z
        .string()
        .trim()
        .email("Invalid email")
        .optional()
        .or(z.literal("")),
      phone: z.string().trim().max(30).optional().or(z.literal("")),
      invite: z.boolean(),
    })
    .optional(),
});

export async function runCloseout(
  propertyId: string,
  input: unknown
): Promise<Result> {
  const denied = await denyUnless("property:write");
  if (denied) return denied;

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;

  const res = await executeCloseout(
    {
      propertyId,
      settlement: d.settlement,
      vacated: d.vacated,
      effectiveDate: d.effectiveDate,
      note: d.note || undefined,
      newOwner:
        d.newOwner && d.newOwner.fullName.trim()
          ? {
              fullName: d.newOwner.fullName,
              role: d.newOwner.role,
              email: d.newOwner.email || undefined,
              phone: d.newOwner.phone || undefined,
              invite: d.newOwner.invite,
            }
          : undefined,
    },
    { orgId: org.id, handlerId: user.id }
  );
  if (!res.ok) return res;

  let inviteLink: string | null = null;
  if (res.newHomeownerId && res.wantsInvite) {
    const inv = await inviteHomeowner(res.newHomeownerId);
    if (inv.ok) inviteLink = inv.actionLink;
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  return { ok: true, inviteLink };
}
