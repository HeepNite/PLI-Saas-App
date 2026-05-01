-- CreateTable
CREATE TABLE "StudentDataAudit" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "staffClerkId" TEXT NOT NULL,
    "staffName" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "field" TEXT NOT NULL,
    "valueBefore" JSONB,
    "valueAfter" JSONB,
    "reason" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDataAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDataAudit_targetUserId_createdAt_idx" ON "StudentDataAudit"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentDataAudit_staffClerkId_createdAt_idx" ON "StudentDataAudit"("staffClerkId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentDataAudit_entity_createdAt_idx" ON "StudentDataAudit"("entity", "createdAt");
