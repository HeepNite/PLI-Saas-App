-- One-time opaque native-admission capabilities for durable pending purchases.
CREATE TABLE "PreparedNativePurchase" (
    "id" TEXT NOT NULL,
    "referenceHash" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparedNativePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreparedNativePurchase_referenceHash_key" ON "PreparedNativePurchase"("referenceHash");
CREATE UNIQUE INDEX "PreparedNativePurchase_purchaseId_key" ON "PreparedNativePurchase"("purchaseId");
CREATE INDEX "PreparedNativePurchase_terminalId_sessionId_expiresAt_idx" ON "PreparedNativePurchase"("terminalId", "sessionId", "expiresAt");
CREATE INDEX "PreparedNativePurchase_expiresAt_idx" ON "PreparedNativePurchase"("expiresAt");

ALTER TABLE "PreparedNativePurchase" ADD CONSTRAINT "PreparedNativePurchase_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
