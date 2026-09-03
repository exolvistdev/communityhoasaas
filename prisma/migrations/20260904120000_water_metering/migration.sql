-- 4400 Water Income (INCOME) for every existing org (idempotent).
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type")
SELECT gen_random_uuid()::text, o."id", '4400', 'Water Income', 'INCOME'::"AccountType"
FROM "organizations" o
ON CONFLICT ("orgId", "code") DO NOTHING;

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "waterBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "waterServiceCharge" DECIMAL(12,2),
  ADD COLUMN "waterRateBands" JSONB;

-- CreateTable
CREATE TABLE "water_meters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "installedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_meters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "water_meters_propertyId_key" ON "water_meters"("propertyId");
CREATE INDEX "water_meters_orgId_idx" ON "water_meters"("orgId");

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "priorReading" DECIMAL(12,2) NOT NULL,
    "currentReading" DECIMAL(12,2) NOT NULL,
    "consumption" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceId" TEXT,
    "enteredById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "meter_readings_invoiceId_key" ON "meter_readings"("invoiceId");
CREATE UNIQUE INDEX "meter_readings_meterId_period_key" ON "meter_readings"("meterId", "period");
CREATE INDEX "meter_readings_orgId_period_idx" ON "meter_readings"("orgId", "period");

-- AddForeignKey
ALTER TABLE "water_meters" ADD CONSTRAINT "water_meters_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "water_meters" ADD CONSTRAINT "water_meters_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "water_meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
