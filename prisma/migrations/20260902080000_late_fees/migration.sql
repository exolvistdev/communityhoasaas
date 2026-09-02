-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('FIXED', 'PERCENT');

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "lateFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lateFeeType" "LateFeeType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "lateFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lateFeeMaxOccurrences" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "lateFeeParentId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_lateFeeParentId_idx" ON "invoices"("lateFeeParentId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lateFeeParentId_fkey" FOREIGN KEY ("lateFeeParentId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
