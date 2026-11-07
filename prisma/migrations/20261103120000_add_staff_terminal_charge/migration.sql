-- Staff-initiated card charges collected on a tablet's paired M2 reader.
CREATE TABLE "StaffTerminalCharge" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "collectingAt" TIMESTAMP(3),
    "carrierPurchaseId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTerminalCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffTerminalChargeItem" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "beneficiaryUserId" TEXT,
    "courseSlug" TEXT,
    "packageId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "outstandingPurchaseId" TEXT,
    "outstandingAttendanceId" TEXT,
    "description" TEXT,
    "guestName" TEXT,
    "resultPurchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTerminalChargeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffTerminalCharge_carrierPurchaseId_key" ON "StaffTerminalCharge"("carrierPurchaseId");
CREATE INDEX "StaffTerminalCharge_terminalId_status_expiresAt_idx" ON "StaffTerminalCharge"("terminalId", "status", "expiresAt");
CREATE INDEX "StaffTerminalCharge_payerUserId_idx" ON "StaffTerminalCharge"("payerUserId");
CREATE INDEX "StaffTerminalCharge_status_createdAt_idx" ON "StaffTerminalCharge"("status", "createdAt");
CREATE INDEX "StaffTerminalChargeItem_chargeId_idx" ON "StaffTerminalChargeItem"("chargeId");
CREATE INDEX "StaffTerminalChargeItem_outstandingPurchaseId_idx" ON "StaffTerminalChargeItem"("outstandingPurchaseId");
CREATE INDEX "StaffTerminalChargeItem_outstandingAttendanceId_idx" ON "StaffTerminalChargeItem"("outstandingAttendanceId");

ALTER TABLE "StaffTerminalCharge" ADD CONSTRAINT "StaffTerminalCharge_terminalId_fkey"
  FOREIGN KEY ("terminalId") REFERENCES "StaffTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffTerminalCharge" ADD CONSTRAINT "StaffTerminalCharge_payerUserId_fkey"
  FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffTerminalChargeItem" ADD CONSTRAINT "StaffTerminalChargeItem_chargeId_fkey"
  FOREIGN KEY ("chargeId") REFERENCES "StaffTerminalCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
