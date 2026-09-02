-- CreateEnum
CREATE TYPE "TransferSettlement" AS ENUM ('SETTLED', 'WRITTEN_OFF', 'CARRIED_TO_NEW_OWNER');

-- CreateTable
CREATE TABLE "ownership_transfers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "previousOwnerName" TEXT NOT NULL,
    "newOwnerName" TEXT,
    "vacated" BOOLEAN NOT NULL DEFAULT false,
    "finalBalance" DECIMAL(12,2) NOT NULL,
    "settlement" "TransferSettlement" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "handledById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ownership_transfers_orgId_createdAt_idx" ON "ownership_transfers"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ownership_transfers_propertyId_idx" ON "ownership_transfers"("propertyId");

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
