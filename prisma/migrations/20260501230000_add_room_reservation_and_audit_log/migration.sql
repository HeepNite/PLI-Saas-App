-- Add room reservations and room audit logs (additive only).
CREATE TABLE "RoomReservation" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdByClerkUserId" TEXT NOT NULL,
    "assignedStaffClerkUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByClerkUserId" TEXT,
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomAuditLog" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "roomNameSnapshot" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorClerkUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "reason" TEXT,
    "outcome" TEXT NOT NULL,
    "blockers" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomReservation_roomId_startsAt_idx" ON "RoomReservation"("roomId", "startsAt");
CREATE INDEX "RoomReservation_status_startsAt_idx" ON "RoomReservation"("status", "startsAt");
CREATE INDEX "RoomReservation_assignedStaffClerkUserId_startsAt_idx" ON "RoomReservation"("assignedStaffClerkUserId", "startsAt");

CREATE INDEX "RoomAuditLog_roomId_createdAt_idx" ON "RoomAuditLog"("roomId", "createdAt");
CREATE INDEX "RoomAuditLog_action_createdAt_idx" ON "RoomAuditLog"("action", "createdAt");
CREATE INDEX "RoomAuditLog_actorClerkUserId_createdAt_idx" ON "RoomAuditLog"("actorClerkUserId", "createdAt");

ALTER TABLE "RoomReservation"
ADD CONSTRAINT "RoomReservation_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "RoomAuditLog"
ADD CONSTRAINT "RoomAuditLog_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
