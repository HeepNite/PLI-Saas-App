-- CreateTable
CREATE TABLE "ClerkIdMigration" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "oldClerkId" TEXT NOT NULL,
    "newClerkId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "phase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "ClerkIdMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClerkIdMigration_newClerkId_idx" ON "ClerkIdMigration"("newClerkId");

-- CreateIndex
CREATE INDEX "ClerkIdMigration_phase_idx" ON "ClerkIdMigration"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "ClerkIdMigration_entity_appId_key" ON "ClerkIdMigration"("entity", "appId");
