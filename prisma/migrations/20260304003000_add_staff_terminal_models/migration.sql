-- CreateTable
CREATE TABLE "StaffTerminal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "defaultCourseSlug" TEXT,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTerminalSession" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTerminalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffTerminal_slug_key" ON "StaffTerminal"("slug");

-- CreateIndex
CREATE INDEX "StaffTerminal_active_idx" ON "StaffTerminal"("active");

-- CreateIndex
CREATE INDEX "StaffTerminal_defaultCourseSlug_idx" ON "StaffTerminal"("defaultCourseSlug");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTerminalSession_tokenHash_key" ON "StaffTerminalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffTerminalSession_terminalId_idx" ON "StaffTerminalSession"("terminalId");

-- CreateIndex
CREATE INDEX "StaffTerminalSession_expiresAt_idx" ON "StaffTerminalSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffTerminalSession" ADD CONSTRAINT "StaffTerminalSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "StaffTerminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
