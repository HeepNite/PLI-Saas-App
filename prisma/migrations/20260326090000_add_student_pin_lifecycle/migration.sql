-- CreateTable
CREATE TABLE "StudentPinCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pinHash" TEXT NOT NULL,
    "pinLookupDigest" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastPinAuthAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPinCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPinAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorClerkId" TEXT,
    "actorRole" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "credentialKind" TEXT,
    "terminalId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPinAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskIdentificationSession" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialKind" TEXT NOT NULL,
    "requiresPinRotation" BOOLEAN NOT NULL DEFAULT false,
    "rotationBypassed" BOOLEAN NOT NULL DEFAULT false,
    "checkoutContext" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskIdentificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskTerminalMissCounter" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KioskTerminalMissCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentPinCredential_userId_kind_key" ON "StudentPinCredential"("userId", "kind");

-- CreateIndex
CREATE INDEX "StudentPinCredential_kind_status_expiresAt_idx" ON "StudentPinCredential"("kind", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "StudentPinCredential_pinLookupDigest_idx" ON "StudentPinCredential"("pinLookupDigest");

-- CreateIndex
CREATE INDEX "StudentPinCredential_pinLookupDigest_status_idx" ON "StudentPinCredential"("pinLookupDigest", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPinCredential_active_pinLookupDigest_key" ON "StudentPinCredential"("pinLookupDigest") WHERE "status" IN ('active', 'rotation_required');

-- CreateIndex
CREATE INDEX "StudentPinCredential_lockedAt_idx" ON "StudentPinCredential"("lockedAt");

-- CreateIndex
CREATE INDEX "StudentPinAudit_userId_createdAt_idx" ON "StudentPinAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentPinAudit_actorClerkId_createdAt_idx" ON "StudentPinAudit"("actorClerkId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentPinAudit_action_createdAt_idx" ON "StudentPinAudit"("action", "createdAt");

-- CreateIndex
CREATE INDEX "KioskIdentificationSession_terminalId_idx" ON "KioskIdentificationSession"("terminalId");

-- CreateIndex
CREATE INDEX "KioskIdentificationSession_userId_idx" ON "KioskIdentificationSession"("userId");

-- CreateIndex
CREATE INDEX "KioskIdentificationSession_expiresAt_idx" ON "KioskIdentificationSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KioskTerminalMissCounter_terminalId_key" ON "KioskTerminalMissCounter"("terminalId");

-- CreateIndex
CREATE INDEX "KioskTerminalMissCounter_blockedUntil_idx" ON "KioskTerminalMissCounter"("blockedUntil");

-- AddForeignKey
ALTER TABLE "StudentPinCredential" ADD CONSTRAINT "StudentPinCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPinAudit" ADD CONSTRAINT "StudentPinAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskIdentificationSession" ADD CONSTRAINT "KioskIdentificationSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "StaffTerminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskIdentificationSession" ADD CONSTRAINT "KioskIdentificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskTerminalMissCounter" ADD CONSTRAINT "KioskTerminalMissCounter_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "StaffTerminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
