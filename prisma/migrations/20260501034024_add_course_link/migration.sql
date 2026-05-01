-- DropIndex
DROP INDEX "PackagePlan_courseSlugs_idx";

-- CreateTable
CREATE TABLE "CourseLink" (
    "id" TEXT NOT NULL,
    "courseSlugA" TEXT NOT NULL,
    "courseSlugB" TEXT NOT NULL,
    "dropInConsecutiveCents" INTEGER NOT NULL,
    "packageHolderConsecutiveCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLink_courseSlugA_idx" ON "CourseLink"("courseSlugA");

-- CreateIndex
CREATE INDEX "CourseLink_courseSlugB_idx" ON "CourseLink"("courseSlugB");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLink_courseSlugA_courseSlugB_key" ON "CourseLink"("courseSlugA", "courseSlugB");

-- CreateIndex
CREATE INDEX "PackagePlan_courseSlugs_idx" ON "PackagePlan"("courseSlugs");
