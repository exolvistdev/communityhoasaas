-- CreateTable
CREATE TABLE "gate_pass_scans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "gatePassId" TEXT,
    "code" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_pass_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gate_pass_scans_orgId_scannedAt_idx" ON "gate_pass_scans"("orgId", "scannedAt");

-- AddForeignKey
ALTER TABLE "gate_pass_scans" ADD CONSTRAINT "gate_pass_scans_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_scans" ADD CONSTRAINT "gate_pass_scans_gatePassId_fkey" FOREIGN KEY ("gatePassId") REFERENCES "gate_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_scans" ADD CONSTRAINT "gate_pass_scans_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
