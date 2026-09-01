"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { generateGatePassCode } from "@/lib/gatepass";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const createSchema = z
  .object({
    propertyId: z.string().uuid("Choose a property"),
    visitorName: z.string().trim().min(2, "Enter the visitor's name"),
    validFrom: z.coerce.date({ invalid_type_error: "Invalid start time" }),
    validUntil: z.coerce.date({ invalid_type_error: "Invalid end time" }),
  })
  .refine((d) => d.validUntil > d.validFrom, {
    message: "The end time must be after the start time",
    path: ["validUntil"],
  });

export async function createGatePass(
  input: unknown
): Promise<Result<{ code: string }>> {
  const denied = await denyUnless("gatepass:write");
  if (denied) return denied;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;

  const property = await prisma.property.findFirst({
    where: { id: d.propertyId, orgId: org.id },
  });
  if (!property) return { ok: false, error: "Property not found" };

  // Retry on the (astronomically unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGatePassCode();
    try {
      await prisma.gatePass.create({
        data: {
          code,
          propertyId: d.propertyId,
          createdById: user.id,
          visitorName: d.visitorName,
          validFrom: d.validFrom,
          validUntil: d.validUntil,
          status: "ACTIVE",
        },
      });
      revalidatePath("/gate-passes");
      revalidatePath(`/properties/${d.propertyId}`);
      revalidatePath("/dashboard");
      return { ok: true, code };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        continue;
      throw e;
    }
  }
  return { ok: false, error: "Could not generate a unique code — try again" };
}

export async function revokeGatePass(id: string): Promise<Result> {
  const denied = await denyUnless("gatepass:write");
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();

  const pass = await prisma.gatePass.findFirst({
    where: { id, property: { orgId: org.id } },
  });
  if (!pass) return { ok: false, error: "Gate pass not found" };
  if (pass.status === "REVOKED")
    return { ok: false, error: "Already revoked" };

  await prisma.gatePass.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  revalidatePath("/gate-passes");
  revalidatePath(`/properties/${pass.propertyId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
