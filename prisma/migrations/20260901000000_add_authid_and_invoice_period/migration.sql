-- AlterTable
ALTER TABLE "users" ADD COLUMN "authId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "period" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_authId_key" ON "users"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_propertyId_period_key" ON "invoices"("propertyId", "period");
