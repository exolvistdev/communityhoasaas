-- Buildings / towers within a condominium project. Optional and tenant-scoped;
-- subdivisions never create a row here.

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buildings_orgId_idx" ON "buildings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_orgId_name_key" ON "buildings"("orgId", "name");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (baseline: enable only, no policies — matches every other public table;
-- new tables must enable it explicitly, grants apply automatically).
ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY;
