/*
  Warnings:

  - A unique constraint covering the columns `[userId,sessionId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[courseSlug,startsAt]` on the table `ClassSession` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[purchaseId]` on the table `PackagePurchase` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PackagePurchase" ADD COLUMN     "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "packagePlanId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'stripe',
ALTER COLUMN "totalCredits" DROP NOT NULL,
ALTER COLUMN "remainingCredits" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PackagePlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "courseSlug" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "cadence" TEXT,
    "totalCredits" INTEGER,
    "makeUps" INTEGER NOT NULL DEFAULT 0,
    "validDays" INTEGER NOT NULL DEFAULT 180,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageUsageLedger" (
    "id" TEXT NOT NULL,
    "packagePurchaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackagePlan_key_key" ON "PackagePlan"("key");

-- CreateIndex
CREATE INDEX "PackagePlan_courseSlug_idx" ON "PackagePlan"("courseSlug");

-- CreateIndex
CREATE INDEX "PackagePlan_active_idx" ON "PackagePlan"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PackageUsageLedger_attendanceId_key" ON "PackageUsageLedger"("attendanceId");

-- CreateIndex
CREATE INDEX "PackageUsageLedger_packagePurchaseId_idx" ON "PackageUsageLedger"("packagePurchaseId");

-- CreateIndex
CREATE INDEX "PackageUsageLedger_userId_createdAt_idx" ON "PackageUsageLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PackageUsageLedger_reason_idx" ON "PackageUsageLedger"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_sessionId_key" ON "Attendance"("userId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_courseSlug_startsAt_key" ON "ClassSession"("courseSlug", "startsAt");

-- CreateIndex
CREATE INDEX "PackagePurchase_packagePlanId_idx" ON "PackagePurchase"("packagePlanId");

-- CreateIndex
CREATE INDEX "PackagePurchase_expiresAt_idx" ON "PackagePurchase"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackagePurchase_purchaseId_key" ON "PackagePurchase"("purchaseId");

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "PackagePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsageLedger" ADD CONSTRAINT "PackageUsageLedger_packagePurchaseId_fkey" FOREIGN KEY ("packagePurchaseId") REFERENCES "PackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsageLedger" ADD CONSTRAINT "PackageUsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsageLedger" ADD CONSTRAINT "PackageUsageLedger_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
