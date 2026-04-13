-- AlterTable
ALTER TABLE "StaffAccount" ADD COLUMN     "paymentPreference" TEXT;

-- CreateTable
CREATE TABLE "StaffClockEntry" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "expectedClockOutAt" TIMESTAMP(3) NOT NULL,
    "actualClockOutAt" TIMESTAMP(3),
    "totalExpectedMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'clocked_in',
    "courseSlugs" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffClockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffClockEntry_staffAccountId_idx" ON "StaffClockEntry"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffClockEntry_clockInAt_idx" ON "StaffClockEntry"("clockInAt");

-- CreateIndex
CREATE INDEX "StaffClockEntry_status_idx" ON "StaffClockEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffClockEntry_staffAccountId_clockInAt_key" ON "StaffClockEntry"("staffAccountId", "clockInAt");

-- AddForeignKey
ALTER TABLE "StaffClockEntry" ADD CONSTRAINT "StaffClockEntry_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PreparedCheckoutContext_terminalId_kioskSessionId_classSlotKe_k" RENAME TO "PreparedCheckoutContext_terminalId_kioskSessionId_classSlot_key";
