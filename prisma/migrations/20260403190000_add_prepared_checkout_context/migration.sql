-- CreateTable
CREATE TABLE "PreparedCheckoutContext" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "kioskSessionId" TEXT NOT NULL,
    "classSlotKey" TEXT NOT NULL,
    "dbUserId" TEXT,
    "resolvedClerkUserId" TEXT,
    "resolvedEmail" TEXT NOT NULL,
    "phoneRaw" TEXT,
    "phoneNormalized" TEXT NOT NULL,
    "accountSnapshot" JSONB NOT NULL,
    "verificationSnapshot" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparedCheckoutContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreparedCheckoutContext_terminalId_kioskSessionId_classSlotKe_key" ON "PreparedCheckoutContext"("terminalId", "kioskSessionId", "classSlotKey");

-- CreateIndex
CREATE INDEX "PreparedCheckoutContext_terminalId_kioskSessionId_expiresAt_idx" ON "PreparedCheckoutContext"("terminalId", "kioskSessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "PreparedCheckoutContext_expiresAt_idx" ON "PreparedCheckoutContext"("expiresAt");

-- AddForeignKey
ALTER TABLE "PreparedCheckoutContext" ADD CONSTRAINT "PreparedCheckoutContext_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "StaffTerminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
