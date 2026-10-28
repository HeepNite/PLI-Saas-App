import type Stripe from "stripe"
import type { Prisma, Purchase } from "@prisma/client"
import { mergeFailureIntoMetadata, normalizeNativeFailureFromPaymentIntent } from "@/lib/stripe-failure"

/** Purchase statuses on which a declined/canceled prepared native attempt may be recorded. */
export const PREPARED_NATIVE_RECORDABLE_STATUSES = ["pending", "failed", "canceled"]

export type PreparedNativeFailureStatus = "failed" | "canceled"

type PurchaseWriter = { purchase: { updateMany: (args: Prisma.PurchaseUpdateManyArgs) => Promise<{ count: number }> } }

type RecordablePurchase = Pick<Purchase, "id" | "status" | "metadata">

export const isCanceledLoggedPaymentIntent = (metadata: unknown, paymentIntentId: string) => {
  const attempts = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).paymentAttempts
    : undefined
  return Array.isArray(attempts) && attempts.some((attempt) =>
    Boolean(attempt) && typeof attempt === "object" &&
    (attempt as Record<string, unknown>).paymentIntentId === paymentIntentId &&
    (attempt as Record<string, unknown>).status === "canceled")
}

/**
 * Records a declined/canceled prepared native attempt on its unpaid Purchase so staff can
 * verify it (status + allowlisted reason + attempt log). Never fulfills, never binds a
 * PaymentIntent, never downgrades a paid row. A cancellation already logged for the same
 * PaymentIntent is not logged twice, so the kiosk cancel and a later webhook stay idempotent.
 *
 * `requireBoundIntent` restricts the write to a Purchase still bound to this exact
 * PaymentIntent; otherwise an unbound (null) Purchase is also accepted, as on the webhook.
 */
export async function recordPreparedNativeAttemptFailure(
  db: PurchaseWriter,
  purchase: RecordablePurchase,
  intent: Stripe.PaymentIntent,
  source: Pick<Stripe.Event, "type" | "created">,
  status: PreparedNativeFailureStatus,
  options: { requireBoundIntent?: boolean } = {},
) {
  if (!PREPARED_NATIVE_RECORDABLE_STATUSES.includes(purchase.status)) return false
  if (status === "canceled" && purchase.status === "canceled" && isCanceledLoggedPaymentIntent(purchase.metadata, intent.id)) return false
  const binding = options.requireBoundIntent
    ? { stripePaymentIntentId: intent.id }
    : { OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: intent.id }] }
  const result = await db.purchase.updateMany({
    where: { id: purchase.id, status: { in: PREPARED_NATIVE_RECORDABLE_STATUSES }, ...binding },
    data: {
      status,
      metadata: mergeFailureIntoMetadata(purchase.metadata, normalizeNativeFailureFromPaymentIntent(intent, source), { channel: "native_m2", status }) as Prisma.InputJsonValue,
    },
  })
  return result.count > 0
}
