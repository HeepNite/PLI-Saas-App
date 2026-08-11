CREATE TABLE "StudentRecoveryDraft" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT,
  "correlationId" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "name" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentRecoveryDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentRecoveryTicket" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "tokenHash" TEXT,
  "correlationId" TEXT NOT NULL,
  "staffClerkId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentRecoveryTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentRecoveryDraft_codeHash_key" ON "StudentRecoveryDraft"("codeHash");
CREATE UNIQUE INDEX "StudentRecoveryDraft_correlationId_key" ON "StudentRecoveryDraft"("correlationId");
CREATE INDEX "StudentRecoveryDraft_status_expiresAt_idx" ON "StudentRecoveryDraft"("status", "expiresAt");
CREATE UNIQUE INDEX "StudentRecoveryTicket_tokenHash_key" ON "StudentRecoveryTicket"("tokenHash");
CREATE UNIQUE INDEX "StudentRecoveryTicket_correlationId_key" ON "StudentRecoveryTicket"("correlationId");
CREATE INDEX "StudentRecoveryTicket_status_expiresAt_idx" ON "StudentRecoveryTicket"("status", "expiresAt");
CREATE INDEX "StudentRecoveryTicket_draftId_idx" ON "StudentRecoveryTicket"("draftId");
ALTER TABLE "StudentRecoveryTicket" ADD CONSTRAINT "StudentRecoveryTicket_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "StudentRecoveryDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
