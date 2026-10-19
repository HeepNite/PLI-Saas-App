-- CreateTable
CREATE TABLE "RaffleDrawAttempt" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RaffleDrawAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaffleDrawAttempt_drawId_status_idx" ON "RaffleDrawAttempt"("drawId", "status");

-- CreateIndex
CREATE INDEX "RaffleDrawAttempt_entryId_status_idx" ON "RaffleDrawAttempt"("entryId", "status");

-- AddForeignKey
ALTER TABLE "RaffleDrawAttempt" ADD CONSTRAINT "RaffleDrawAttempt_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "RaffleDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleDrawAttempt" ADD CONSTRAINT "RaffleDrawAttempt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RaffleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
