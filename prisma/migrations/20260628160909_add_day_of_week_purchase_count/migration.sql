-- CreateTable
CREATE TABLE "DayOfWeekPurchaseCount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastCountedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayOfWeekPurchaseCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayOfWeekPurchaseCount_userId_dayOfWeek_key" ON "DayOfWeekPurchaseCount"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DayOfWeekPurchaseCount_userId_idx" ON "DayOfWeekPurchaseCount"("userId");

-- AddForeignKey
ALTER TABLE "DayOfWeekPurchaseCount" ADD CONSTRAINT "DayOfWeekPurchaseCount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
