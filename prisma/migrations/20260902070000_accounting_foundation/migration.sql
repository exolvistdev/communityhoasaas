-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "createdById" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN "reversalOfId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "journal_entries_orgId_entryDate_idx" ON "journal_entries"("orgId", "entryDate");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expand the chart of accounts for every existing org (idempotent).
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type")
SELECT gen_random_uuid()::text, o."id", v.code, v.name, v.type::"AccountType"
FROM "organizations" o
CROSS JOIN (VALUES
  ('2000', 'Accounts Payable', 'LIABILITY'),
  ('3000', 'Fund Balance', 'EQUITY'),
  ('3900', 'Opening Balance Equity', 'EQUITY'),
  ('4100', 'Late Fee Income', 'INCOME'),
  ('4200', 'Other Income', 'INCOME'),
  ('5000', 'Operating Expenses', 'EXPENSE'),
  ('5100', 'Utilities', 'EXPENSE'),
  ('5200', 'Repairs & Maintenance', 'EXPENSE'),
  ('5300', 'Security', 'EXPENSE'),
  ('5400', 'Admin & Office', 'EXPENSE'),
  ('5900', 'Other Expense', 'EXPENSE'),
  ('6000', 'Bad Debt Expense', 'EXPENSE')
) AS v(code, name, type)
ON CONFLICT ("orgId", "code") DO NOTHING;

-- Backfill entryDate from the linked source document so period reports are accurate.
UPDATE "journal_entries" je SET "entryDate" = i."createdAt"
FROM "invoices" i WHERE je."invoiceId" = i."id";

UPDATE "journal_entries" je SET "entryDate" = p."paidAt"
FROM "payments" p WHERE je."paymentId" = p."id";
