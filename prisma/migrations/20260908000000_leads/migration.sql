-- Public marketing-site demo/sales enquiries. Not tenant-scoped — a prospect
-- who hasn't signed up. Written from the /contact form's server action.

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hoaName" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- RLS (baseline: enable only, no policies — matches every other public table;
-- new tables must enable it explicitly, grants apply automatically).
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
