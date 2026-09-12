-- CreateTable
CREATE TABLE "RaffleEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'PLE',
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "excludePreviousWinners" BOOLEAN NOT NULL DEFAULT true,
    "screenTokenHash" TEXT NOT NULL,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "phoneCountry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleDraw" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "drawAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "drawingStartedAt" TIMESTAMP(3),
    "winnerEntryId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEvent_slug_key" ON "RaffleEvent"("slug");

-- CreateIndex
CREATE INDEX "RaffleEntry_eventId_createdAt_idx" ON "RaffleEntry"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_eventId_phoneE164_key" ON "RaffleEntry"("eventId", "phoneE164");

-- CreateIndex
CREATE INDEX "RaffleDraw_eventId_status_idx" ON "RaffleDraw"("eventId", "status");

-- CreateIndex
CREATE INDEX "RaffleDraw_winnerEntryId_idx" ON "RaffleDraw"("winnerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleDraw_eventId_order_key" ON "RaffleDraw"("eventId", "order");

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RaffleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleDraw" ADD CONSTRAINT "RaffleDraw_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RaffleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleDraw" ADD CONSTRAINT "RaffleDraw_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "RaffleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

