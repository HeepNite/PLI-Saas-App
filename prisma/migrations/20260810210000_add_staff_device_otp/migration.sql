-- CreateTable
CREATE TABLE "StaffTrustedDevice" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StaffTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPinAttemptCounter" (
    "id" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeMissCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "cooldownLevel" INTEGER NOT NULL DEFAULT 0,
    "lockedPermanentlyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPinAttemptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEnrollmentChallenge" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffEnrollmentChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffTrustedDevice_tokenHash_key" ON "StaffTrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffTrustedDevice_staffUserId_idx" ON "StaffTrustedDevice"("staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPinAttemptCounter_targetKey_key" ON "StaffPinAttemptCounter"("targetKey");

-- CreateIndex
CREATE INDEX "StaffPinAttemptCounter_blockedUntil_idx" ON "StaffPinAttemptCounter"("blockedUntil");

-- CreateIndex
CREATE INDEX "StaffEnrollmentChallenge_staffUserId_idx" ON "StaffEnrollmentChallenge"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffEnrollmentChallenge_expiresAt_idx" ON "StaffEnrollmentChallenge"("expiresAt");
