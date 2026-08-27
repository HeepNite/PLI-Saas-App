-- Backward-compatible foundation. Existing purchases remain valid because all
-- special-class purchase fields are nullable.
CREATE TABLE "SpecialClass" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "classSessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "currency" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "salesOpenAt" TIMESTAMP(3),
    "salesCloseAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SpecialClass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialClassAuditLog" (
    "id" TEXT NOT NULL,
    "specialClassId" TEXT NOT NULL,
    "classSessionId" TEXT,
    "purchaseId" TEXT,
    "attendanceId" TEXT,
    "action" TEXT NOT NULL,
    "actorClerkUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reason" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialClassAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Purchase" ADD COLUMN "specialClassId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "classSessionId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);

ALTER TABLE "SpecialClass" ADD CONSTRAINT "SpecialClass_status_check" CHECK ("status" IN ('draft', 'published', 'closed', 'cancelled'));
ALTER TABLE "SpecialClass" ADD CONSTRAINT "SpecialClass_priceCents_check" CHECK ("priceCents" > 0);
ALTER TABLE "SpecialClass" ADD CONSTRAINT "SpecialClass_currency_check" CHECK ("currency" ~ '^[a-z]{3}$');
ALTER TABLE "SpecialClass" ADD CONSTRAINT "SpecialClass_sales_window_check" CHECK ("salesOpenAt" IS NULL OR "salesCloseAt" IS NULL OR "salesOpenAt" < "salesCloseAt");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_special_class_links_check" CHECK (
    ("specialClassId" IS NULL AND "classSessionId" IS NULL AND "holdExpiresAt" IS NULL)
    OR ("specialClassId" IS NOT NULL AND "classSessionId" IS NOT NULL AND "participants" = 1)
);

CREATE UNIQUE INDEX "SpecialClass_slug_key" ON "SpecialClass"("slug");
CREATE UNIQUE INDEX "SpecialClass_classSessionId_key" ON "SpecialClass"("classSessionId");
CREATE INDEX "SpecialClass_status_salesOpenAt_salesCloseAt_idx" ON "SpecialClass"("status", "salesOpenAt", "salesCloseAt");
CREATE INDEX "Purchase_specialClassId_status_holdExpiresAt_idx" ON "Purchase"("specialClassId", "status", "holdExpiresAt");
CREATE INDEX "Purchase_classSessionId_idx" ON "Purchase"("classSessionId");
CREATE INDEX "SpecialClassAuditLog_specialClassId_createdAt_idx" ON "SpecialClassAuditLog"("specialClassId", "createdAt");
CREATE INDEX "SpecialClassAuditLog_correlationId_idx" ON "SpecialClassAuditLog"("correlationId");
CREATE INDEX "SpecialClassAuditLog_idempotencyKey_idx" ON "SpecialClassAuditLog"("idempotencyKey");
CREATE INDEX "SpecialClassAuditLog_action_createdAt_idx" ON "SpecialClassAuditLog"("action", "createdAt");
CREATE UNIQUE INDEX "SpecialClassAuditLog_specialClassId_correlationId_key" ON "SpecialClassAuditLog"("specialClassId", "correlationId");
CREATE UNIQUE INDEX "SpecialClassAuditLog_specialClassId_idempotencyKey_key" ON "SpecialClassAuditLog"("specialClassId", "idempotencyKey");

ALTER TABLE "SpecialClass" ADD CONSTRAINT "SpecialClass_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialClassAuditLog" ADD CONSTRAINT "SpecialClassAuditLog_specialClassId_fkey" FOREIGN KEY ("specialClassId") REFERENCES "SpecialClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_specialClassId_fkey" FOREIGN KEY ("specialClassId") REFERENCES "SpecialClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
