-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_authId_key" ON "platform_admins"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateTable
CREATE TABLE "impersonation_events" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetOrgName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_events_platformAdminId_startedAt_idx" ON "impersonation_events"("platformAdminId", "startedAt");

-- AddForeignKey
ALTER TABLE "impersonation_events" ADD CONSTRAINT "impersonation_events_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_events" ADD CONSTRAINT "impersonation_events_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
