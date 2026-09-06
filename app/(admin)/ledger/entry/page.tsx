import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader
        title="Record a journal entry"
        description="For expenses, other income, opening balances and corrections. Dues invoices and payments post themselves — don't enter those here."
        backLink={{ href: "/ledger?view=journal", label: "Ledger" }}
      />
      <EntryForm accounts={accounts} />
    </div>
  );
}
