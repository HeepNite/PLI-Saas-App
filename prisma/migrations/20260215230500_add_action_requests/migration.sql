CREATE TABLE "ActionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "meta" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionRequest_userId_createdAt_idx" ON "ActionRequest"("userId", "createdAt");
CREATE INDEX "ActionRequest_status_idx" ON "ActionRequest"("status");
CREATE INDEX "ActionRequest_type_idx" ON "ActionRequest"("type");

ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
