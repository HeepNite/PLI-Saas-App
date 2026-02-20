-- Add optional unique event key to make one-time point grants idempotent.
ALTER TABLE "PointsLedger"
ADD COLUMN "eventKey" TEXT;

CREATE UNIQUE INDEX "PointsLedger_eventKey_key" ON "PointsLedger"("eventKey");
