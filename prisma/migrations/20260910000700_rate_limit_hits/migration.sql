-- Per-request log for rate-limited pre-auth surfaces (login, signup, password
-- reset, lead form, gate-pass lookup). Not tenant-scoped. Pruned per-key on
-- each check; a sweep clears the tail.

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_hits_bucket_key_at_idx" ON "rate_limit_hits"("bucket", "key", "at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_at_idx" ON "rate_limit_hits"("at");

-- RLS (baseline: enable only, no policies — matches every other public table).
ALTER TABLE "rate_limit_hits" ENABLE ROW LEVEL SECURITY;
