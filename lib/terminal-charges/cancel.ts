import "server-only"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { preparedNativeFulfillmentMetadata, validatePreparedNativePaymentIntent } from "@/lib/stripe/prepared-native-payment"
import { recordPreparedNativeAttemptFailure } from "@/lib/stripe/prepared-native-attempt-failure"
import { asObject } from "@/lib/shared"
import {
  ACTIVE_STATUSES,
  conflict,
  expireStalePendingCharges,
  notFound,
  requireChargeView,
  TerminalChargeError,
  type StaffActor,
} from "@/lib/terminal-charges/service"

// Same guarantees as the tablet's prepared-cancel (apps/backend/src/terminal/internal-purchase.service.ts):
// only states in which Stripe guarantees no charge has happened, with the same idempotency key.
const PREPARED_CANCELABLE_STATUSES = new Set(["requires_payment_method", "requires_confirmation", "requires_action"])
const PAYMENT_RECEIVED = "Payment received, finishing up"
const READER_STARTED = "The card reader just started; try again"
const NEEDS_REVIEW = "Payment needs review in Stripe"

// The live key the tablet's prepared attempt used to create the PaymentIntent, else the webhook's key.
let cancelStripeClient: Stripe | null = null
const stripeForCancel = () => {
  const secret = process.env.STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) throw conflict("Card reader cancellation is unavailable")
  cancelStripeClient ??= new Stripe(secret, { apiVersion: "2026-01-28.clover", maxNetworkRetries: 0, timeout: 10_000 })
  return cancelStripeClient
}

/**
 * Makes sure no money can be taken for a collecting charge before it is cancelled: cancels the
 * carrier's bound PaymentIntent when Stripe guarantees it was never charged, and refuses (409)
 * when the payment succeeded (the webhook will mark the charge paid) or may still succeed.
 * Returns the PaymentIntent it confirmed canceled (null when none was bound yet).
 */
const releaseCarrierPaymentIntent = async (carrierPurchaseId: string | null) => {
  const carrier = carrierPurchaseId ? await prisma.purchase.findUnique({ where: { id: carrierPurchaseId } }) : null
  if (carrier?.status === "paid") throw conflict(PAYMENT_RECEIVED)
  const paymentIntentId = carrier?.stripePaymentIntentId
  if (!carrier || !paymentIntentId) return null
  try {
    if (!carrier.idempotencyKey) throw conflict(NEEDS_REVIEW)
    const { id, userId, amount, currency, idempotencyKey } = carrier
    const proof = { id, userId, amount, currency, idempotencyKey, fulfillmentMetadata: preparedNativeFulfillmentMetadata(carrier.metadata) }
    const stripe = stripeForCancel()
    const read = async () => {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (intent.id !== paymentIntentId) throw conflict(NEEDS_REVIEW)
      validatePreparedNativePaymentIntent(intent, undefined, proof)
      return intent
    }
    let intent = await read()
    if (PREPARED_CANCELABLE_STATUSES.has(intent.status)) {
      // A failed cancel means it was already canceled (e.g. by the tablet) or moved on: re-read it.
      intent = await stripe.paymentIntents
        .cancel(paymentIntentId, {}, { idempotencyKey: `prepared-native-m2-cancel:v1:${paymentIntentId}` })
        .catch(read)
      if (intent.id !== paymentIntentId) throw conflict(NEEDS_REVIEW)
    }
    if (intent.status === "succeeded") throw conflict(PAYMENT_RECEIVED)
    if (intent.status !== "canceled") throw conflict("Card is being processed")

    // Record the canceled attempt on the carrier exactly as prepared-cancel does (Verify history).
    const current = await prisma.purchase.findUnique({ where: { id: carrier.id } })
    if (current?.stripePaymentIntentId === intent.id) {
      const created = typeof intent.canceled_at === "number" ? intent.canceled_at : Math.floor(Date.now() / 1000)
      await recordPreparedNativeAttemptFailure(prisma, current, intent, { type: "payment_intent.canceled", created }, "canceled", { requireBoundIntent: true })
    }
    return paymentIntentId
  } catch (error) {
    if (error instanceof TerminalChargeError) throw error
    throw conflict("Could not confirm the card payment with Stripe; try again")
  }
}

/**
 * Cancels a pending or collecting charge (D5), from the panel (`staff`) or its own tablet
 * (`terminalId`). A collecting charge is cancelled only after Stripe confirms no money can be
 * taken; a charge whose PaymentIntent succeeded or is being processed is refused (409).
 */
export const cancelTerminalCharge = async (input: { id: string; staff?: StaffActor; terminalId?: string; ipAddress?: string | null }) => {
  const scope = { id: input.id, ...(input.terminalId ? { terminalId: input.terminalId } : {}) }
  await expireStalePendingCharges(prisma, scope)
  const charge = await prisma.staffTerminalCharge.findFirst({
    where: scope,
    select: { id: true, status: true, payerUserId: true, terminalId: true, createdByUserId: true, carrierPurchaseId: true },
  })
  if (!charge) throw notFound()
  if (charge.status === "cancelled") return requireChargeView(prisma, { id: charge.id })
  if (!ACTIVE_STATUSES.includes(charge.status)) throw conflict("This charge can no longer be cancelled")
  const collecting = charge.status === "collecting"
  const releasedPaymentIntentId = collecting ? await releaseCarrierPaymentIntent(charge.carrierPurchaseId) : null

  return prisma.$transaction(async (tx) => {
    // Close the still-pending carrier (no PaymentIntent, or only the one confirmed canceled above):
    // prepared-attempt only admits pending purchases, so the tablet can never collect it. If the
    // reader bound a PaymentIntent after the Stripe check, abort so that payment is never unchecked.
    if (collecting && charge.carrierPurchaseId) {
      const unbound = [{ stripePaymentIntentId: null }, ...(releasedPaymentIntentId ? [{ stripePaymentIntentId: releasedPaymentIntentId }] : [])]
      const closed = await tx.purchase.updateMany({ where: { id: charge.carrierPurchaseId, status: "pending", OR: unbound }, data: { status: "failed" } })
      const carrier = closed.count === 1 ? null : await tx.purchase.findUnique({ where: { id: charge.carrierPurchaseId } })
      if (carrier?.status === "pending" && carrier.stripePaymentIntentId && carrier.stripePaymentIntentId !== releasedPaymentIntentId) {
        throw conflict(READER_STARTED)
      }
    }
    const now = new Date()
    const updated = await tx.staffTerminalCharge.updateMany({
      where: { ...scope, status: charge.status },
      data: {
        status: "cancelled",
        cancelledAt: now,
        resolvedAt: now,
        failureReason: input.staff ? "cancelled_by_staff" : "cancelled_on_tablet",
        ...(input.staff ? { cancelledByUserId: input.staff.userId } : {}),
      },
    })
    if (updated.count !== 1) {
      // A canceled-PaymentIntent webhook may have ended it first; anything else changed under us.
      const current = await requireChargeView(tx, { id: charge.id })
      if (current.status === "cancelled") return current
      throw conflict(current.status === "collecting" ? READER_STARTED : "This charge can no longer be cancelled")
    }
    await writeStudentDataAudit({
      targetUserId: charge.payerUserId,
      staffClerkId: input.staff?.userId ?? charge.createdByUserId,
      staffName: input.staff?.staffName,
      entity: "payment",
      entityId: charge.id,
      field: input.staff ? "terminal_charge_cancel" : "terminal_charge_result",
      valueBefore: { status: charge.status },
      valueAfter: { status: "cancelled", terminalId: charge.terminalId },
      reason: input.staff ? "Staff cancelled a tablet card charge" : "Charge cancelled on the tablet",
      ipAddress: input.ipAddress,
    }, tx)
    return requireChargeView(tx, { id: charge.id })
  })
}

/** Tablet-reported end of a collection. `paid` is only ever set by the Stripe webhook. */
export const recordTerminalChargeResult = async (input: { terminalId: string; id: string; body: unknown }) => {
  const outcome = asObject(input.body).outcome
  if (outcome === "cancelled") return cancelTerminalCharge({ id: input.id, terminalId: input.terminalId })
  if (outcome !== "declined") throw new TerminalChargeError(400, "Invalid outcome")
  return prisma.$transaction(async (tx) => {
    const charge = await tx.staffTerminalCharge.findFirst({
      where: { id: input.id, terminalId: input.terminalId },
      select: { id: true, status: true, payerUserId: true, createdByUserId: true },
    })
    if (!charge) throw notFound()
    if (charge.status === "declined") return requireChargeView(tx, { id: charge.id })
    // A decline only exists once the reader collected.
    const updated = await tx.staffTerminalCharge.updateMany({
      where: { id: charge.id, status: "collecting" },
      data: { status: "declined", resolvedAt: new Date(), failureReason: "card_declined" },
    })
    if (updated.count !== 1) throw conflict("This charge is not being collected")
    await writeStudentDataAudit({
      targetUserId: charge.payerUserId,
      staffClerkId: charge.createdByUserId,
      entity: "payment",
      entityId: charge.id,
      field: "terminal_charge_result",
      valueBefore: { status: charge.status },
      valueAfter: { status: "declined", terminalId: input.terminalId },
      reason: "Card declined on the tablet",
    }, tx)
    return requireChargeView(tx, { id: charge.id })
  })
}
