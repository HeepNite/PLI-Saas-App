-- CreateTable
CREATE TABLE "MonthlyBoundary" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByClerkId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyBoundary_closedAt_idx" ON "MonthlyBoundary"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBoundary_year_month_key" ON "MonthlyBoundary"("year", "month");
