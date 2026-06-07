-- CreateTable
CREATE TABLE "CourseMedia" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseMedia_courseId_idx" ON "CourseMedia"("courseId");

-- CreateIndex
CREATE INDEX "CourseMedia_kind_idx" ON "CourseMedia"("kind");

-- CreateIndex
CREATE INDEX "CourseMedia_createdAt_idx" ON "CourseMedia"("createdAt");

-- AddForeignKey
ALTER TABLE "CourseMedia" ADD CONSTRAINT "CourseMedia_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
