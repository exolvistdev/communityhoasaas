-- Per-property-type default dues rates + uploaded payment QR images.
ALTER TABLE "organizations" ADD COLUMN "gcashQrPath" TEXT;
ALTER TABLE "organizations" ADD COLUMN "mayaQrPath" TEXT;
ALTER TABLE "organizations" ADD COLUMN "typeRateResidential" DECIMAL(12,2);
ALTER TABLE "organizations" ADD COLUMN "typeRateCommercial" DECIMAL(12,2);
ALTER TABLE "organizations" ADD COLUMN "typeRateTownhouse" DECIMAL(12,2);
