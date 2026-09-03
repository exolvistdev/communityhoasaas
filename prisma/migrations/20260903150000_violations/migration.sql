-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('OPEN', 'CURED', 'DISMISSED', 'APPEALED');
CREATE TYPE "ViolationCategory" AS ENUM ('NOISE', 'PARKING', 'PET', 'WASTE', 'LANDSCAPING', 'ARCHITECTURAL', 'NUISANCE', 'SAFETY', 'OTHER');

-- 4300 Fine Income (INCOME) for every existing org (idempotent).
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type")
SELECT gen_random_uuid()::text, o."id", '4300', 'Fine Income', 'INCOME'::"AccountType"
FROM "organizations" o
ON CONFLICT ("orgId", "code") DO NOTHING;

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reportedById" TEXT,
    "category" "ViolationCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ViolationStatus" NOT NULL DEFAULT 'OPEN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "cureByDate" TIMESTAMP(3),
    "photos" TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "violations_orgId_status_idx" ON "violations"("orgId", "status");
CREATE INDEX "violations_propertyId_idx" ON "violations"("propertyId");

-- CreateTable
CREATE TABLE "fine_notices" (
    "id" TEXT NOT NULL,
    "violationId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "noticeNumber" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceId" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "fine_notices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fine_notices_invoiceId_key" ON "fine_notices"("invoiceId");
CREATE INDEX "fine_notices_orgId_idx" ON "fine_notices"("orgId");
CREATE INDEX "fine_notices_violationId_idx" ON "fine_notices"("violationId");

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "violations" ADD CONSTRAINT "violations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "violations" ADD CONSTRAINT "violations_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fine_notices" ADD CONSTRAINT "fine_notices_violationId_fkey" FOREIGN KEY ("violationId") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fine_notices" ADD CONSTRAINT "fine_notices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fine_notices" ADD CONSTRAINT "fine_notices_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fine_notices" ADD CONSTRAINT "fine_notices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
