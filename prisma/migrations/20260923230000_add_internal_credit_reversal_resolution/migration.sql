-- Additive B2 reversal-resolution history. Existing rows retain null bindings/reasons.
ALTER TABLE "StripeWebhookEvent"
  ADD COLUMN "purchaseId" TEXT,
  ADD COLUMN "resolutionReason" TEXT;

CREATE INDEX "StripeWebhookEvent_purchaseId_idx" ON "StripeWebhookEvent"("purchaseId");

ALTER TABLE "StripeWebhookEvent"
  ADD CONSTRAINT "StripeWebhookEvent_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
