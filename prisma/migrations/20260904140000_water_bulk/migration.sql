-- 5150 Water Purchased (EXPENSE) for every existing org (idempotent).
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type")
SELECT gen_random_uuid()::text, o."id", '5150', 'Water Purchased', 'EXPENSE'::"AccountType"
FROM "organizations" o
ON CONFLICT ("orgId", "code") DO NOTHING;

-- CreateEnum
CREATE TYPE "WaterLossPolicy" AS ENUM ('DISTRIBUTE', 'ABSORB');
CREATE TYPE "WaterMeterKind" AS ENUM ('UNIT', 'SOURCE');

-- AlterTable organizations
ALTER TABLE "organizations"
  ADD COLUMN "waterLossPolicy" "WaterLossPolicy" NOT NULL DEFAULT 'DISTRIBUTE',
  ADD COLUMN "waterAdminFeeFlat" DECIMAL(12,2),
  ADD COLUMN "waterUtilityVendorId" TEXT;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_waterUtilityVendorId_fkey"
  FOREIGN KEY ("waterUtilityVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable water_meters
ALTER TABLE "water_meters"
  ADD COLUMN "kind" "WaterMeterKind" NOT NULL DEFAULT 'UNIT',
  ADD COLUMN "initialReading" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "water_meters" ALTER COLUMN "propertyId" DROP NOT NULL;

-- Replace the blanket unique with partial ones: one active UNIT meter per unit,
-- one active SOURCE meter per org.
DROP INDEX "water_meters_propertyId_key";
CREATE UNIQUE INDEX "water_meters_active_unit_key" ON "water_meters"("propertyId")
  WHERE "retiredAt" IS NULL AND "kind" <> 'SOURCE';
CREATE UNIQUE INDEX "water_meters_active_source_key" ON "water_meters"("orgId")
  WHERE "kind" = 'SOURCE' AND "retiredAt" IS NULL;

-- AlterTable meter_readings
ALTER TABLE "meter_readings" ADD COLUMN "flag" TEXT;

-- CreateTable water_allocation_runs
CREATE TABLE "water_allocation_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "billId" TEXT,
    "bulkAmount" DECIMAL(12,2) NOT NULL,
    "sourceConsumption" DECIMAL(12,2) NOT NULL,
    "meteredConsumption" DECIMAL(12,2) NOT NULL,
    "commonConsumption" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "systemLoss" DECIMAL(12,2) NOT NULL,
    "effectiveRate" DECIMAL(12,4) NOT NULL,
    "lossPolicy" "WaterLossPolicy" NOT NULL,
    "adminFeeFlat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitsBilled" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_allocation_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "water_allocation_runs_billId_key" ON "water_allocation_runs"("billId");
CREATE UNIQUE INDEX "water_allocation_runs_orgId_period_key" ON "water_allocation_runs"("orgId", "period");
CREATE INDEX "water_allocation_runs_orgId_period_idx" ON "water_allocation_runs"("orgId", "period");

ALTER TABLE "water_allocation_runs" ADD CONSTRAINT "water_allocation_runs_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "water_allocation_runs" ADD CONSTRAINT "water_allocation_runs_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "water_allocation_runs" ADD CONSTRAINT "water_allocation_runs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
