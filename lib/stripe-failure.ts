import type Stripe from "stripe"
import type { JsonValue } from "@prisma/client/runtime/library"

/**
 * Allowlisted failure info persisted in Purchase.metadata.stripeFailure.
 * Never spread raw Stripe objects into metadata — this type IS the contract.
 */
export type StripeFailureInfo = {
  eventType: string
  occurredAt: string
  paymentIntentId?: string
  checkoutSessionId?: string
  error?: {
    message?: string
    code?: string
    declineCode?: string
    type?: string
  }
  card?: {
    brand?: string
    last4?: string
  }
}

/**
 * Normalize a payment_intent.payment_failed event into StripeFailureInfo.
 * Extracts only allowlisted fields from last_payment_error.
 */
export function normalizeFailureFromPaymentIntent(
  intent: Stripe.PaymentIntent,
  event: Stripe.Event
): StripeFailureInfo {
  const lastError = intent.last_payment_error as Stripe.StripeError | null | undefined

  const card = extractCardFromError(lastError)

  return {
    eventType: event.type,
    occurredAt: new Date(event.created * 1000).toISOString(),
    paymentIntentId: intent.id,
    error: extractErrorFields(lastError),
    card,
  }
}

/**
 * Normalize a checkout.session.expired or checkout.session.async_payment_failed event.
 */
export function normalizeFailureFromCheckoutSession(
  session: Stripe.Checkout.Session,
  event: Stripe.Event
): StripeFailureInfo {
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id

  return {
    eventType: event.type,
    occurredAt: new Date(event.created * 1000).toISOString(),
    paymentIntentId: paymentIntent,
    checkoutSessionId: session.id,
  }
}

/**
 * Deep-merge failure info into existing metadata without clobbering other keys.
 * Returns a JsonObject-safe value.
 */
export function mergeFailureIntoMetadata(
  existing: JsonValue | null | undefined,
  failure: StripeFailureInfo
): Record<string, unknown> {
  const base = toPlainObject(existing)
  return { ...base, stripeFailure: failure }
}

/** Prisma-compatible JSON object type */
type JsonObject = Record<string, unknown>

/**
 * Remove stripeFailure from metadata. Returns empty object when metadata becomes empty (Prisma-compatible).
 */
export function clearFailureFromMetadata(
  existing: unknown
): JsonObject {
  const obj = toPlainObjectFromUnknown(existing)
  if (!obj || !("stripeFailure" in obj)) {
    return obj && Object.keys(obj).length > 0 ? obj : {}
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stripeFailure: _removed, ...rest } = obj
  return rest
}

/**
 * Merge incoming metadata with existing, preserving stripeFailure from existing.
 * Use this when updating a Purchase with new Stripe session metadata.
 */
export function mergeMetadataPreservingFailure(
  existing: unknown,
  incoming: JsonObject | null | undefined
): JsonObject {
  const base = toPlainObjectFromUnknown(existing)
  const stripeFailure = base.stripeFailure
  return { ...base, ...(incoming ?? {}), ...(stripeFailure ? { stripeFailure } : {}) }
}

function toPlainObjectFromUnknown(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject
  }
  return {}
}

/**
 * Runtime guard: validate that a value matches StripeFailureInfo shape.
 * Never trust raw DB JSON — this enforces the allowlisted contract.
 */
export function isStripeFailureInfo(value: unknown): value is StripeFailureInfo {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  if (typeof obj.eventType !== "string") return false
  if (typeof obj.occurredAt !== "string") return false

  if ("error" in obj && obj.error != null) {
    if (typeof obj.error !== "object") return false
    const err = obj.error as Record<string, unknown>
    if (
      "message" in err && err.message != null && typeof err.message !== "string"
    ) return false
    if (
      "code" in err && err.code != null && typeof err.code !== "string"
    ) return false
    if (
      "declineCode" in err && err.declineCode != null && typeof err.declineCode !== "string"
    ) return false
    if (
      "type" in err && err.type != null && typeof err.type !== "string"
    ) return false
  }

  if ("card" in obj && obj.card != null) {
    if (typeof obj.card !== "object") return false
    const card = obj.card as Record<string, unknown>
    if (
      "brand" in card && card.brand != null && typeof card.brand !== "string"
    ) return false
    if (
      "last4" in card && card.last4 != null && typeof card.last4 !== "string"
    ) return false
  }

  return true
}

// ─── Private helpers ───────────────────────────────────────────────

function extractErrorFields(error: Stripe.StripeError | null | undefined) {
  if (!error) return undefined

  const result: StripeFailureInfo["error"] = {}
  if (error.message) result.message = error.message
  if (error.code) result.code = error.code
  if ("decline_code" in error && error.decline_code) result.declineCode = error.decline_code as string
  if (error.type) result.type = error.type

  return Object.keys(result).length > 0 ? result : undefined
}

function extractCardFromError(error: Stripe.StripeError | null | undefined) {
  if (!error || !("payment_method" in error) || !error.payment_method) return undefined

  const pm = error.payment_method as Stripe.PaymentIntent.LastPaymentError.PaymentMethod | undefined
  if (!pm || typeof pm !== "object") return undefined

  const card = "card" in pm ? pm.card : undefined
  if (!card || typeof card !== "object") return undefined

  const result: StripeFailureInfo["card"] = {}
  if (card.brand) result.brand = card.brand
  if (card.last4) result.last4 = card.last4

  return Object.keys(result).length > 0 ? result : undefined
}

function toPlainObject(value: JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
