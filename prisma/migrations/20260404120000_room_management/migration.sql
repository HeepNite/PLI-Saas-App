-- Create rooms without backfilling existing sessions.
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClassSession"
ADD COLUMN "roomId" TEXT;

ALTER TABLE "CourseCatalog"
ADD COLUMN "defaultRoomId" TEXT;

CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
CREATE INDEX "Room_active_idx" ON "Room"("active");
CREATE INDEX "ClassSession_roomId_startsAt_idx" ON "ClassSession"("roomId", "startsAt");
CREATE INDEX "CourseCatalog_defaultRoomId_idx" ON "CourseCatalog"("defaultRoomId");

ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "CourseCatalog"
ADD CONSTRAINT "CourseCatalog_defaultRoomId_fkey"
FOREIGN KEY ("defaultRoomId") REFERENCES "Room"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
