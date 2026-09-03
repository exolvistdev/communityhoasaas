"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate() {
  revalidatePath("/vendors");
  revalidatePath("/bills");
}

async function guard() {
  return denyUnless("vendor:manage");
}

const vendorSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function parse(input: unknown) {
  const p = vendorSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0].message };
  const d = p.data;
  return {
    ok: true as const,
    data: {
      name: d.name,
      contactName: d.contactName || null,
      email: d.email || null,
      phone: d.phone || null,
      notes: d.notes || null,
    },
  };
}

export async function createVendor(input: unknown): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;
  const p = parse(input);
  if (!p.ok) return p;

  const { org } = await getCurrentOrgContext();
  const vendor = await prisma.vendor.create({
    data: { orgId: org.id, ...p.data },
  });
  await logAudit({ action: "vendor.create", target: vendor.name });
  revalidate();
  return { ok: true, id: vendor.id };
}

export async function updateVendor(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const p = parse(input);
  if (!p.ok) return p;

  const { org } = await getCurrentOrgContext();
  const existing = await prisma.vendor.findFirst({ where: { id, orgId: org.id } });
  if (!existing) return { ok: false, error: "Vendor not found" };

  await prisma.vendor.update({ where: { id }, data: p.data });
  await logAudit({ action: "vendor.update", target: p.data.name });
  revalidate();
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}

export async function setVendorArchived(
  id: string,
  archived: boolean
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const vendor = await prisma.vendor.findFirst({ where: { id, orgId: org.id } });
  if (!vendor) return { ok: false, error: "Vendor not found" };

  await prisma.vendor.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
  await logAudit({
    action: "vendor.archive",
    target: vendor.name,
    detail: archived ? "archived" : "restored",
  });
  revalidate();
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}
