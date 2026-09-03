-- CreateEnum
CREATE TYPE "ReadingKind" AS ENUM ('ACTUAL', 'ESTIMATED');

-- AlterTable
ALTER TABLE "meter_readings" ADD COLUMN "kind" "ReadingKind" NOT NULL DEFAULT 'ACTUAL';
ALTER TABLE "water_meters" ADD COLUMN "label" TEXT;
