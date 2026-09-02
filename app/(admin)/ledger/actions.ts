"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { postManualEntry } from "@/lib/ledger";

type Result = { ok: true } | { ok: false; error: string };

const lineSchema = z.object({
  code: z.string().trim().min(1),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
});

const entrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  memo: z.string().trim().min(2, "Add a description").max(300),
  lines: z.array(lineSchema).min(2, "An entry needs at least two lines"),
});

/** Noon on the given calendar day — safe from UTC/PHT date-edge drift. */
function entryDate(ymd: string) {
  return new Date(`${ymd}T12:00:00+08:00`);
}

export async function recordManualEntry(input: unknown): Promise<Result> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const parsed = entrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;

  try {
    await postManualEntry({
      orgId: org.id,
      entryDate: entryDate(d.entryDate),
      memo: d.memo,
      createdById: user.id,
      lines: d.lines,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  await logAudit({ action: "ledger.manual_entry", target: d.memo });
  return { ok: true };
}

export async function reverseManualEntry(entryId: string): Promise<Result> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const { org, user } = await getCurrentOrgContext();
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, orgId: org.id, sourceType: "manual" },
    include: { lines: { include: { account: true } }, reversedBy: true },
  });
  if (!entry) return { ok: false, error: "Entry not found" };
  if (entry.reversalOfId)
    return { ok: false, error: "You can't reverse a reversal." };
  if (entry.reversedBy)
    return { ok: false, error: "This entry has already been reversed." };

  try {
    await postManualEntry({
      orgId: org.id,
      entryDate: new Date(),
      memo: `Reversal — ${entry.memo ?? "manual entry"}`,
      createdById: user.id,
      reversalOfId: entry.id,
      lines: entry.lines.map((l) => ({
        code: l.account.code,
        debit: Number(l.credit),
        credit: Number(l.debit),
      })),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  await logAudit({
    action: "ledger.reverse_entry",
    target: entry.memo ?? entryId,
  });
  return { ok: true };
}
