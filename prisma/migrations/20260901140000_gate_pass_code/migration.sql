-- AlterTable: add nullable, backfill, then enforce
ALTER TABLE "gate_passes" ADD COLUMN "code" TEXT;

UPDATE "gate_passes"
SET "code" = upper(substr(md5(random()::text || id), 1, 8))
WHERE "code" IS NULL;

ALTER TABLE "gate_passes" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_code_key" ON "gate_passes"("code");
