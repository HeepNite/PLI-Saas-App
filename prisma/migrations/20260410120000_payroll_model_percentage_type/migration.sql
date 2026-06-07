-- AlterTable: add percentage payment type fields to StaffPaymentModel
ALTER TABLE "StaffPaymentModel" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'per_hour';
ALTER TABLE "StaffPaymentModel" ADD COLUMN "percentageRate" DOUBLE PRECISION;
ALTER TABLE "StaffPaymentModel" ADD COLUMN "revenueBase" TEXT DEFAULT 'class_revenue';
