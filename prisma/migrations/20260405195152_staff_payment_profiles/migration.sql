-- AlterTable
ALTER TABLE "StaffAccount" ADD COLUMN     "paymentInfo" JSONB,
ADD COLUMN     "subCategory" TEXT;

-- Data migration: normalize guest_staff to guest
UPDATE "StaffAccount" SET "category" = 'guest' WHERE "category" = 'guest_staff';

-- CreateIndex
CREATE INDEX "StaffAccount_subCategory_idx" ON "StaffAccount"("subCategory");
