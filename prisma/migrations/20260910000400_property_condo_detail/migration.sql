-- Condominium detail on each property. All nullable — house-and-lot properties
-- leave every column null and behave exactly as before.
--   buildingId      — the tower this unit sits in (nullable FK → buildings)
--   floor           — free text ("G", "14", "PH"), matching unitNumber's style
--   floorArea       — sqm; drives per-sqm dues (later slice) and floor-area vote weighting
--   commonAreaShare — master-deed appurtenant interest; vote weighting derives it
--                     from floorArea when this is null
ALTER TABLE "properties"
    ADD COLUMN "buildingId" TEXT,
    ADD COLUMN "floor" TEXT,
    ADD COLUMN "floorArea" DECIMAL(12,2),
    ADD COLUMN "commonAreaShare" DECIMAL(9,4);

-- CreateIndex
CREATE INDEX "properties_buildingId_idx" ON "properties"("buildingId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
