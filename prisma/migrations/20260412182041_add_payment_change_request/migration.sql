-- CreateTable
CREATE TABLE "StaffPaymentChangeRequest" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "requestedMethod" TEXT NOT NULL,
    "requestedInfo" JSONB NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPaymentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPaymentChangeRequest_staffAccountId_idx" ON "StaffPaymentChangeRequest"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffPaymentChangeRequest_status_idx" ON "StaffPaymentChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "StaffPaymentChangeRequest" ADD CONSTRAINT "StaffPaymentChangeRequest_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
