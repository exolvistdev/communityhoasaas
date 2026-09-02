import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { EntryForm } from "./EntryForm";

export const metadata = { title: "Record entry · HOA SaaS" };

export default async function RecordEntryPage() {
  const { org } = await requirePermission("billing:write");

  const accounts = await prisma.account.findMany({
    where: { orgId: org.id },
    select: { code: true, name: true, type: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/ledger?view=journal"
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Ledger
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-fg">Record a journal entry</h1>
        <p className="text-sm text-fg-muted">
          For expenses, other income, opening balances and corrections. Dues
          invoices and payments post themselves — don&apos;t enter those here.
        </p>
      </div>
      <EntryForm accounts={accounts} />
    </div>
  );
}
