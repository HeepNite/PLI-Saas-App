-- Add missing package pricing field used by staff school builder
ALTER TABLE "PackagePlan"
ADD COLUMN IF NOT EXISTS "priceCents" INTEGER;

-- Catalog used by School Builder (courses/programs/workshops)
CREATE TABLE IF NOT EXISTS "CourseCatalog" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'course',
  "category" TEXT,
  "description" TEXT,
  "level" TEXT,
  "durationMinutes" INTEGER,
  "location" TEXT,
  "availableWeekdays" INTEGER[] NOT NULL,
  "availableTimes" TEXT[] NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseCatalog_slug_key" ON "CourseCatalog"("slug");
CREATE INDEX IF NOT EXISTS "CourseCatalog_kind_idx" ON "CourseCatalog"("kind");
CREATE INDEX IF NOT EXISTS "CourseCatalog_active_idx" ON "CourseCatalog"("active");

-- Staff-managed points rule catalog
CREATE TABLE IF NOT EXISTS "PointsRule" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "eventType" TEXT NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PointsRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointsRule_key_key" ON "PointsRule"("key");
CREATE INDEX IF NOT EXISTS "PointsRule_eventType_idx" ON "PointsRule"("eventType");
CREATE INDEX IF NOT EXISTS "PointsRule_active_idx" ON "PointsRule"("active");
