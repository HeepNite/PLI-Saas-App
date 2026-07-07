-- CreateTable
CREATE TABLE "StaffEnrollmentChallenge" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffEnrollmentChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffEnrollmentChallenge_staffUserId_idx" ON "StaffEnrollmentChallenge"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffEnrollmentChallenge_expiresAt_idx" ON "StaffEnrollmentChallenge"("expiresAt");
