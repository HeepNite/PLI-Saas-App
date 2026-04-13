-- AlterTable
ALTER TABLE "StaffAccount" ADD COLUMN     "creditCapCents" INTEGER,
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "paydayWeekday" INTEGER,
ADD COLUMN     "paymentModelId" TEXT;

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPaymentModel" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "paydayWeekday" INTEGER NOT NULL,
    "creditCapCents" INTEGER NOT NULL DEFAULT 0,
    "defaultPaymentMethodId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPaymentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPaymentMethod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "configJson" JSONB,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayrollEntry" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethodId" TEXT,
    "paymentModelId" TEXT,
    "idempotencyKey" TEXT,
    "proposedAmount" INTEGER,
    "proposedBy" TEXT,
    "rejectionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "paidAmount" INTEGER,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "amountOverrideReason" TEXT,
    "amountOverriddenBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "eventKey" TEXT,
    "awardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayrollBonus" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "entryId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayrollBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUnavailabilityRequest" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUnavailabilityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPaymentSchedule" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "paydayWeekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayrollAudit" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "staffAccountId" TEXT,
    "type" TEXT NOT NULL,
    "actorClerkUserId" TEXT,
    "previousValue" JSONB,
    "nextValue" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayrollAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Currency_active_idx" ON "Currency"("active");

-- CreateIndex
CREATE INDEX "StaffPaymentModel_schoolId_idx" ON "StaffPaymentModel"("schoolId");

-- CreateIndex
CREATE INDEX "StaffPaymentModel_isDefault_idx" ON "StaffPaymentModel"("isDefault");

-- CreateIndex
CREATE INDEX "StaffPaymentMethod_schoolId_idx" ON "StaffPaymentMethod"("schoolId");

-- CreateIndex
CREATE INDEX "StaffPaymentMethod_active_idx" ON "StaffPaymentMethod"("active");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPaymentMethod_schoolId_name_key" ON "StaffPaymentMethod"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StaffPayrollEntry_staffAccountId_idx" ON "StaffPayrollEntry"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffPayrollEntry_idempotencyKey_idx" ON "StaffPayrollEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StaffPayrollEntry_status_idx" ON "StaffPayrollEntry"("status");

-- CreateIndex
CREATE INDEX "StaffPayrollEntry_periodStart_idx" ON "StaffPayrollEntry"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayrollEntry_staffAccountId_periodStart_periodEnd_key" ON "StaffPayrollEntry"("staffAccountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "StaffCreditLedgerEntry_staffAccountId_createdAt_idx" ON "StaffCreditLedgerEntry"("staffAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCreditLedgerEntry_staffAccountId_eventKey_key" ON "StaffCreditLedgerEntry"("staffAccountId", "eventKey");

-- CreateIndex
CREATE INDEX "StaffPayrollBonus_staffAccountId_active_idx" ON "StaffPayrollBonus"("staffAccountId", "active");

-- CreateIndex
CREATE INDEX "StaffPayrollBonus_entryId_idx" ON "StaffPayrollBonus"("entryId");

-- CreateIndex
CREATE INDEX "StaffUnavailabilityRequest_staffAccountId_idx" ON "StaffUnavailabilityRequest"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffUnavailabilityRequest_status_idx" ON "StaffUnavailabilityRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPaymentSchedule_staffAccountId_key" ON "StaffPaymentSchedule"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffPayrollAudit_entryId_idx" ON "StaffPayrollAudit"("entryId");

-- CreateIndex
CREATE INDEX "StaffPayrollAudit_staffAccountId_idx" ON "StaffPayrollAudit"("staffAccountId");

-- CreateIndex
CREATE INDEX "StaffPayrollAudit_type_idx" ON "StaffPayrollAudit"("type");

-- CreateIndex
CREATE INDEX "StaffPayrollAudit_createdAt_idx" ON "StaffPayrollAudit"("createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_staffAccountId_read_idx" ON "StaffNotification"("staffAccountId", "read");

-- CreateIndex
CREATE INDEX "StaffNotification_createdAt_idx" ON "StaffNotification"("createdAt");

-- CreateIndex
CREATE INDEX "StaffAccount_paymentModelId_idx" ON "StaffAccount"("paymentModelId");

-- AddForeignKey
ALTER TABLE "StaffAccount" ADD CONSTRAINT "StaffAccount_paymentModelId_fkey" FOREIGN KEY ("paymentModelId") REFERENCES "StaffPaymentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentModel" ADD CONSTRAINT "StaffPaymentModel_currency_fkey" FOREIGN KEY ("currency") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentModel" ADD CONSTRAINT "StaffPaymentModel_defaultPaymentMethodId_fkey" FOREIGN KEY ("defaultPaymentMethodId") REFERENCES "StaffPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentMethod" ADD CONSTRAINT "StaffPaymentMethod_currency_fkey" FOREIGN KEY ("currency") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollEntry" ADD CONSTRAINT "StaffPayrollEntry_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollEntry" ADD CONSTRAINT "StaffPayrollEntry_currency_fkey" FOREIGN KEY ("currency") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollEntry" ADD CONSTRAINT "StaffPayrollEntry_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "StaffPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollEntry" ADD CONSTRAINT "StaffPayrollEntry_paymentModelId_fkey" FOREIGN KEY ("paymentModelId") REFERENCES "StaffPaymentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCreditLedgerEntry" ADD CONSTRAINT "StaffCreditLedgerEntry_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollBonus" ADD CONSTRAINT "StaffPayrollBonus_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollBonus" ADD CONSTRAINT "StaffPayrollBonus_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "StaffPayrollEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUnavailabilityRequest" ADD CONSTRAINT "StaffUnavailabilityRequest_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentSchedule" ADD CONSTRAINT "StaffPaymentSchedule_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollAudit" ADD CONSTRAINT "StaffPayrollAudit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "StaffPayrollEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollAudit" ADD CONSTRAINT "StaffPayrollAudit_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
