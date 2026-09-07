-- Additive native Fast Tap schema. Roll back only after every initiated job is finalized or explicitly failed.
-- Rollback order: attendance grants, sales, payment jobs, then readers.

-- CreateTable
CREATE TABLE "NativeReader" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NativeReader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativePaymentJob" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "courseSlugSnapshot" TEXT NOT NULL,
    "courseTitleSnapshot" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "reconcileAfter" TIMESTAMP(3),
    "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastReconcileError" TEXT,
    "lastReconciledAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NativePaymentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousSale" (
    "id" TEXT NOT NULL,
    "paymentJobId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnonymousSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousAttendanceGrant" (
    "id" TEXT NOT NULL,
    "paymentJobId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnonymousAttendanceGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeReader_tokenHash_key" ON "NativeReader"("tokenHash");
CREATE INDEX "NativeReader_active_idx" ON "NativeReader"("active");
CREATE UNIQUE INDEX "NativePaymentJob_idempotencyKey_key" ON "NativePaymentJob"("idempotencyKey");
CREATE UNIQUE INDEX "NativePaymentJob_providerPaymentId_key" ON "NativePaymentJob"("providerPaymentId");
CREATE UNIQUE INDEX "NativePaymentJob_id_classSessionId_key" ON "NativePaymentJob"("id", "classSessionId");
CREATE INDEX "NativePaymentJob_readerId_idx" ON "NativePaymentJob"("readerId");
CREATE INDEX "NativePaymentJob_classSessionId_idx" ON "NativePaymentJob"("classSessionId");
CREATE INDEX "NativePaymentJob_status_reconcileAfter_idx" ON "NativePaymentJob"("status", "reconcileAfter");
CREATE INDEX "NativePaymentJob_leaseExpiresAt_idx" ON "NativePaymentJob"("leaseExpiresAt");
CREATE INDEX "NativePaymentJob_needsReview_reconcileAfter_idx" ON "NativePaymentJob"("needsReview", "reconcileAfter");
CREATE UNIQUE INDEX "AnonymousSale_paymentJobId_key" ON "AnonymousSale"("paymentJobId");
CREATE UNIQUE INDEX "AnonymousAttendanceGrant_paymentJobId_key" ON "AnonymousAttendanceGrant"("paymentJobId");
CREATE UNIQUE INDEX "AnonymousAttendanceGrant_paymentJobId_sessionId_key" ON "AnonymousAttendanceGrant"("paymentJobId", "sessionId");
CREATE INDEX "AnonymousAttendanceGrant_sessionId_idx" ON "AnonymousAttendanceGrant"("sessionId");

-- AddForeignKey
ALTER TABLE "NativePaymentJob" ADD CONSTRAINT "NativePaymentJob_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "NativeReader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NativePaymentJob" ADD CONSTRAINT "NativePaymentJob_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymousSale" ADD CONSTRAINT "AnonymousSale_paymentJobId_fkey" FOREIGN KEY ("paymentJobId") REFERENCES "NativePaymentJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymousAttendanceGrant" ADD CONSTRAINT "AnonymousAttendanceGrant_paymentJobId_sessionId_fkey" FOREIGN KEY ("paymentJobId", "sessionId") REFERENCES "NativePaymentJob"("id", "classSessionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymousAttendanceGrant" ADD CONSTRAINT "AnonymousAttendanceGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
