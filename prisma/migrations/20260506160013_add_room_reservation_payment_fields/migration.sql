-- AlterTable
ALTER TABLE "RoomReservation" ADD COLUMN     "cancellationPolicySnapshot" JSONB,
ADD COLUMN     "paymentId" TEXT;
