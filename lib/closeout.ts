import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { postWriteOff } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export type Settlement = "SETTLED" | "WRITTEN_OFF" | "CARRIED_TO_NEW_OWNER";

export type CloseoutInput = {
  propertyId: string;
  settlement: Settlement;
  vacated: boolean;
  effectiveDate: string; // YYYY-MM-DD
  note?: string;
  newOwner?: {
    fullName: string;
    role: "OWNER" | "CO_OWNER" | "RENTER";
    email?: string;
    phone?: string;
    invite: boolean;
  };
};

/* ─────────────────────────────── preview ─────────────────────────── */

/** Everything the close-out wizard needs to show before staff commit. */
export async function buildCloseoutPreview(propertyId: string, orgId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    include: {
      homeowners: {
        include: {
          user: { select: { id: true, email: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!property) return null;

  const statement = await buildStatement(propertyId, parseStatementRange({}));
  const outstanding = Math.max(statement?.closingBalance ?? 0, 0);

  const people = await Promise.all(
    property.homeowners.map(async (h) => {
      let keepsAccess = false;
      if (h.userId) {
        keepsAccess =
          (await prisma.homeowner.count({
            where: {
              userId: h.userId,
              propertyId: { not: propertyId },
              property: { archivedAt: null },
            },
          })) > 0;
      }
      return {
        fullName: h.fullName,
        role: h.role,
        isPrimary: h.isPrimary,
        loginEmail: h.user?.email ?? null,
        keepsAccess,
      };
    })
  );

  return {
    property: {
      id: property.id,
      unitNumber: property.unitNumber,
      archivedAt: property.archivedAt,
    },
    statement,
    outstanding,
    people,
  };
}

/* ─────────────────────────────── execute ────────────────────────── */

export type CloseoutResult =
  | {
      ok: true;
      transferId: string;
      newHomeownerId: string | null;
      wantsInvite: boolean;
    }
  | { ok: false; error: string };

export async function executeCloseout(
  input: CloseoutInput,
  ctx: { orgId: string; handlerId: string }
): Promise<CloseoutResult> {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, orgId: ctx.orgId },
    include: {
      homeowners: {
        include: { user: { select: { id: true, authId: true } } },
      },
    },
  });
  if (!property) return { ok: false, error: "Property not found" };
  if (property.archivedAt)
    return { ok: false, error: "This unit is already archived" };

  const effective = new Date(`${input.effectiveDate}T12:00:00+08:00`);
  if (Number.isNaN(effective.getTime()))
    return { ok: false, error: "Pick a valid effective date" };

  const newOwnerName = input.newOwner?.fullName?.trim();
  if (!input.vacated && !newOwnerName)
    return { ok: false, error: "Enter the new owner, or mark the unit vacated" };
  if (input.vacated && input.settlement === "CARRIED_TO_NEW_OWNER")
    return {
      ok: false,
      error: "A vacated unit has no new owner to carry the balance to",
    };

  const statement = await buildStatement(
    input.propertyId,
    parseStatementRange({})
  );
  const outstanding = Math.max(statement?.closingBalance ?? 0, 0);

  if (input.settlement === "SETTLED" && outstanding > 0.005)
    return {
      ok: false,
      error: `This unit still owes ₱${outstanding.toLocaleString(
        "en-PH"
      )}. Record the payment first, or choose write-off / carry forward.`,
    };

  const previousOwnerName =
    property.homeowners.find((h) => h.isPrimary)?.fullName ??
    property.homeowners[0]?.fullName ??
    "—";

  /* 1 ─ settle the balance ---------------------------------------- */
  if (outstanding > 0.005 && input.settlement === "WRITTEN_OFF") {
    const openInvoices = await prisma.invoice.findMany({
      where: {
        propertyId: input.propertyId,
        status: { notIn: ["PAID", "VOID"] },
      },
      include: {
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
    });
    for (const inv of openInvoices) {
      const paid =
        inv.allocations.reduce((s, a) => s + Number(a.amount), 0) +
        inv.creditApplications.reduce((s, c) => s + Number(c.amount), 0);
      const remaining = Math.round((Number(inv.amount) - paid) * 100) / 100;
      if (remaining <= 0.005) continue;
      const wo = await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          amount: remaining,
          method: "WRITE_OFF",
          status: "CONFIRMED",
          paidAt: effective,
          confirmedById: ctx.handlerId,
          confirmedAt: new Date(),
          note: `Written off on close-out${input.note ? ` — ${input.note}` : ""}`,
        },
      });
      await postWriteOff(wo.id);
    }
  }
  // CARRIED_TO_NEW_OWNER: the balance stays on the Property for the new owner.

  /* 2 ─ revoke logins that no longer own anything here ------------ */
  const authAdmin = createAdminClient().auth.admin;
  const done = new Set<string>();
  for (const h of property.homeowners) {
    if (!h.userId || done.has(h.userId)) continue;
    done.add(h.userId);

    const otherUnits = await prisma.homeowner.count({
      where: {
        userId: h.userId,
        propertyId: { not: input.propertyId },
        property: { archivedAt: null },
      },
    });
    if (otherUnits > 0) continue; // still a resident elsewhere — keep their login

    const u = h.user!;
    await prisma.homeowner.updateMany({
      where: { userId: u.id },
      data: { userId: null },
    });
    try {
      await prisma.user.delete({ where: { id: u.id } });
      if (u.authId) await authAdmin.deleteUser(u.authId).catch(() => {});
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2003"
      ) {
        if (u.authId) {
          const { error } = await authAdmin.deleteUser(u.authId);
          if (error && !/not\s*found/i.test(error.message))
            return {
              ok: false,
              error: "Couldn't revoke a resident's login — please try again.",
            };
        }
        await prisma.$transaction([
          prisma.user.update({
            where: { id: u.id },
            data: { deactivatedAt: new Date(), authId: null },
          }),
          prisma.marketplaceListing.updateMany({
            where: { sellerId: u.id, status: "ACTIVE" },
            data: { status: "WITHDRAWN" },
          }),
        ]);
      } else throw e;
    }
  }

  /* 3 ─ swap the people rows ------------------------------------- */
  await prisma.homeowner.deleteMany({ where: { propertyId: input.propertyId } });

  let newHomeownerId: string | null = null;
  if (newOwnerName) {
    const row = await prisma.homeowner.create({
      data: {
        propertyId: input.propertyId,
        fullName: newOwnerName,
        role: input.newOwner!.role ?? "OWNER",
        email: input.newOwner!.email?.trim() || null,
        phone: input.newOwner!.phone?.trim() || null,
        isPrimary: true,
      },
    });
    newHomeownerId = row.id;
  }

  /* 4 ─ archive a vacated unit --------------------------------- */
  if (input.vacated)
    await prisma.property.update({
      where: { id: input.propertyId },
      data: { archivedAt: new Date() },
    });

  /* 5 ─ record it -------------------------------------------- */
  const transfer = await prisma.ownershipTransfer.create({
    data: {
      orgId: ctx.orgId,
      propertyId: input.propertyId,
      previousOwnerName,
      newOwnerName: newOwnerName || null,
      vacated: input.vacated,
      finalBalance: outstanding,
      settlement: input.settlement,
      effectiveDate: effective,
      handledById: ctx.handlerId,
      note: input.note?.trim() || null,
    },
  });

  const how = input.settlement.toLowerCase().replace(/_/g, " ");
  await logAudit({
    action: "property.ownership_transfer",
    target: property.unitNumber,
    detail: input.vacated
      ? `vacated · balance ${how}`
      : `to ${newOwnerName} · balance ${how}`,
  });

  return {
    ok: true,
    transferId: transfer.id,
    newHomeownerId,
    wantsInvite: Boolean(
      input.newOwner?.invite && input.newOwner?.email?.trim()
    ),
  };
}
