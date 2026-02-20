-- Alter PointsLedger points to float (supports fractional rewards like 2.5)
ALTER TABLE "PointsLedger"
  ALTER COLUMN "points" TYPE DOUBLE PRECISION
  USING "points"::DOUBLE PRECISION;

-- Add session capacity for fullness checks during booking/reschedule
ALTER TABLE "ClassSession"
  ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 12;
