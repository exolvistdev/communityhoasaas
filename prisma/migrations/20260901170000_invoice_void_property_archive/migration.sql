-- AlterTable: Invoice
ALTER TABLE "invoices" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "voidReason" TEXT;

-- AlterTable: Property
ALTER TABLE "properties" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "properties_orgId_archivedAt_idx" ON "properties"("orgId", "archivedAt");
