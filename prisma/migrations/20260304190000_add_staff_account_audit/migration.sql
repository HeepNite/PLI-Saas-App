-- CreateTable
CREATE TABLE "StaffAccount" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL,
    "category" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hasPin" BOOLEAN NOT NULL DEFAULT false,
    "lastSignInAt" TIMESTAMP(3),
    "lastCheckInAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'clerk',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRoleAudit" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT,
    "staffClerkUserId" TEXT NOT NULL,
    "actorClerkUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "previousRole" TEXT,
    "nextRole" TEXT,
    "previousCategory" TEXT,
    "nextCategory" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRoleAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccount_clerkUserId_key" ON "StaffAccount"("clerkUserId");

-- CreateIndex
CREATE INDEX "StaffAccount_role_idx" ON "StaffAccount"("role");

-- CreateIndex
CREATE INDEX "StaffAccount_category_idx" ON "StaffAccount"("category");

-- CreateIndex
CREATE INDEX "StaffAccount_banned_locked_idx" ON "StaffAccount"("banned", "locked");

-- CreateIndex
CREATE INDEX "StaffAccount_updatedAt_idx" ON "StaffAccount"("updatedAt");

-- CreateIndex
CREATE INDEX "StaffRoleAudit_staffClerkUserId_createdAt_idx" ON "StaffRoleAudit"("staffClerkUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffRoleAudit_actorClerkUserId_createdAt_idx" ON "StaffRoleAudit"("actorClerkUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffRoleAudit_action_createdAt_idx" ON "StaffRoleAudit"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffRoleAudit" ADD CONSTRAINT "StaffRoleAudit_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
