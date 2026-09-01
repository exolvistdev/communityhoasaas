-- CreateEnum
CREATE TYPE "HomeownerRole" AS ENUM ('OWNER', 'CO_OWNER', 'RENTER');

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyRate" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_plans_orgId_idx" ON "rate_plans"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plans_orgId_name_key" ON "rate_plans"("orgId", "name");

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "ratePlanId" TEXT;

-- CreateIndex
CREATE INDEX "properties_ratePlanId_idx" ON "properties"("ratePlanId");

-- AlterTable
ALTER TABLE "homeowners" ADD COLUMN "role" "HomeownerRole" NOT NULL DEFAULT 'OWNER';

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
