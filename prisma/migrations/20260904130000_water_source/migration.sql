-- CreateEnum
CREATE TYPE "WaterSource" AS ENUM ('UNSET', 'INTERNAL', 'EXTERNAL_BULK', 'EXTERNAL_DIRECT');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "waterSource" "WaterSource" NOT NULL DEFAULT 'UNSET';

-- Backfill: orgs already billing water are on their own internal source.
UPDATE "organizations" SET "waterSource" = 'INTERNAL' WHERE "waterBillingEnabled" = true;
