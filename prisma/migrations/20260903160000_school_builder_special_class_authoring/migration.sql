-- Add authoring identity without adopting or rewriting existing operational rows.
ALTER TABLE "CourseCatalog"
ADD COLUMN "specialClassOperationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "specialClassCapacity" INTEGER;

ALTER TABLE "SpecialClass"
ADD COLUMN "authoringSlotId" UUID;

CREATE TABLE "CourseCatalogSpecialClassSlot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseCatalogId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseCatalogSpecialClassSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseCatalogAuthoringOperation" (
    "operationId" UUID NOT NULL,
    "courseCatalogId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "resultSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseCatalogAuthoringOperation_pkey" PRIMARY KEY ("operationId")
);

ALTER TABLE "CourseCatalog"
ADD CONSTRAINT "CourseCatalog_specialClassCapacity_check"
CHECK ("specialClassCapacity" IS NULL OR "specialClassCapacity" > 0);

CREATE UNIQUE INDEX "CourseCatalogSpecialClassSlot_courseCatalogId_startsAt_key"
ON "CourseCatalogSpecialClassSlot"("courseCatalogId", "startsAt");
CREATE INDEX "CourseCatalogSpecialClassSlot_courseCatalogId_idx"
ON "CourseCatalogSpecialClassSlot"("courseCatalogId");
CREATE UNIQUE INDEX "SpecialClass_authoringSlotId_key"
ON "SpecialClass"("authoringSlotId");
CREATE INDEX "CourseCatalogAuthoringOperation_courseCatalogId_createdAt_idx"
ON "CourseCatalogAuthoringOperation"("courseCatalogId", "createdAt");

ALTER TABLE "CourseCatalogSpecialClassSlot"
ADD CONSTRAINT "CourseCatalogSpecialClassSlot_courseCatalogId_fkey"
FOREIGN KEY ("courseCatalogId") REFERENCES "CourseCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialClass"
ADD CONSTRAINT "SpecialClass_authoringSlotId_fkey"
FOREIGN KEY ("authoringSlotId") REFERENCES "CourseCatalogSpecialClassSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseCatalogAuthoringOperation"
ADD CONSTRAINT "CourseCatalogAuthoringOperation_courseCatalogId_fkey"
FOREIGN KEY ("courseCatalogId") REFERENCES "CourseCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
