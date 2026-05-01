-- AlterTable
ALTER TABLE "PackagePlan" ADD COLUMN     "courseSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: convert existing single courseSlug to array
UPDATE "PackagePlan" SET "courseSlugs" = ARRAY["courseSlug"] WHERE "courseSlug" IS NOT NULL;

-- Set empty array for any remaining nulls (safety net)
UPDATE "PackagePlan" SET "courseSlugs" = '{}' WHERE "courseSlugs" IS NULL;

-- CreateIndex: GIN index for array containment queries (has, hasSome)
DROP INDEX IF EXISTS "PackagePlan_courseSlugs_idx";
CREATE INDEX "PackagePlan_courseSlugs_idx" ON "PackagePlan" USING GIN ("courseSlugs");
