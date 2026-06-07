ALTER TABLE "PackagePlan"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "launchAt" TIMESTAMP(3);

UPDATE "PackagePlan"
SET "status" = CASE
  WHEN "active" = TRUE THEN 'ACTIVE'
  ELSE 'SUSPENDED'
END
WHERE "status" IS NULL OR "status" = 'ACTIVE';

CREATE INDEX "PackagePlan_status_idx" ON "PackagePlan"("status");
CREATE INDEX "PackagePlan_launchAt_idx" ON "PackagePlan"("launchAt");
