import "server-only"
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import type Stripe from "stripe"
import { internalAttemptSigningKey } from "@/lib/stripe/internal-purchase"

const FLOW = "pli_prepared_native_m2_v1"
export const PREPARED_NATIVE_PAYMENT_TTL_MS = 5 * 60_000
const MAX_TICKET_LENGTH = 2000
const MAX_ID_LENGTH = 128
const DIGEST_PATTERN = /^[a-f0-9]{64}$/
const ID_PATTERN = /^[A-Za-z0-9_-]+$/
const READER_PATTERN = /^tmr_[A-Za-z0-9_]+$/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9:_-]+$/

export type PreparedNativePaymentCaller = { terminalId: string; sessionId: string }
export type PreparedNativePaymentPurchase = {
  id: string
  userId: string
  amount: number
  currency: string
  idempotencyKey: string
  fulfillmentMetadata: Record<string, string>
}
export type PreparedNativePaymentAttempt = PreparedNativePaymentCaller & {
  v: 1
  id: string
  issuedAt: number
  expiresAt: number
  readerId: string
  purchaseId: string
  recipientUserId: string
  amount: number
  currency: string
  selectionDigest: string
}

export class PreparedNativePaymentError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_attempt" | "foreign_caller" | "expired_attempt" | "invalid_purchase" | "payment_mismatch",
    readonly status: 400 | 403 | 409,
  ) {
    super(message)
    this.name = "PreparedNativePaymentError"
  }
}

const invalidAttempt = () => new PreparedNativePaymentError("Invalid prepared native attempt", "invalid_attempt", 400)
const invalidPurchase = () => new PreparedNativePaymentError("Prepared purchase is invalid", "invalid_purchase", 409)
const paymentMismatch = () => new PreparedNativePaymentError("Prepared payment binding mismatch", "payment_mismatch", 409)
const validId = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH && ID_PATTERN.test(value)
const validCurrency = (value: unknown) => typeof value === "string" && /^[a-z]{3}$/.test(value)
const validAmount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0

function canonicalFulfillmentMetadata(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw invalidPurchase()
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.length > 32) throw invalidPurchase()
  for (const [key, item] of entries) {
    if (!/^[a-z][A-Za-z0-9_]{0,63}$/.test(key) || typeof item !== "string" || !item || item.length > 300 || item.trim() !== item || /[\u0000-\u001f\u007f]/.test(item)) throw invalidPurchase()
  }
  const canonical = `{${entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${JSON.stringify(item)}`).join(",")}}`
  if (Buffer.byteLength(canonical) > 4096) throw invalidPurchase()
  return canonical
}

export const nativeFulfillmentMetadataDigest = (metadata: unknown) =>
  createHash("sha256").update(canonicalFulfillmentMetadata(metadata)).digest("hex")

function assertPurchase(purchase: PreparedNativePaymentPurchase): PreparedNativePaymentPurchase {
  if (!purchase || !validId(purchase.id) || !validId(purchase.userId) || !validAmount(purchase.amount) || !validCurrency(purchase.currency) ||
      typeof purchase.idempotencyKey !== "string" || !purchase.idempotencyKey || purchase.idempotencyKey.length > 180 || !IDEMPOTENCY_PATTERN.test(purchase.idempotencyKey)) throw invalidPurchase()
  nativeFulfillmentMetadataDigest(purchase.fulfillmentMetadata)
  return purchase
}

const signature = (payload: string) => createHmac("sha256", internalAttemptSigningKey())
  .update(`${FLOW}:${payload}`).digest("base64url")
const encode = (attempt: PreparedNativePaymentAttempt) => Buffer.from(JSON.stringify(attempt)).toString("base64url")

export function issuePreparedNativePaymentAttempt(caller: PreparedNativePaymentCaller, input: { readerId: string; purchase: PreparedNativePaymentPurchase }) {
  if (!validId(caller.terminalId) || !validId(caller.sessionId) || typeof input.readerId !== "string" || input.readerId.length > MAX_ID_LENGTH || !READER_PATTERN.test(input.readerId)) throw invalidAttempt()
  const purchase = assertPurchase(input.purchase)
  const issuedAt = Date.now()
  const attempt: PreparedNativePaymentAttempt = {
    v: 1, id: randomUUID(), issuedAt, expiresAt: issuedAt + PREPARED_NATIVE_PAYMENT_TTL_MS,
    terminalId: caller.terminalId, sessionId: caller.sessionId, readerId: input.readerId,
    purchaseId: purchase.id, recipientUserId: purchase.userId, amount: purchase.amount, currency: purchase.currency,
    selectionDigest: nativeFulfillmentMetadataDigest(purchase.fulfillmentMetadata),
  }
  const payload = encode(attempt)
  const ticket = `${payload}.${signature(payload)}`
  if (ticket.length > MAX_TICKET_LENGTH) throw invalidAttempt()
  return ticket
}

function decodedAttempt(ticket: unknown): PreparedNativePaymentAttempt {
  if (typeof ticket !== "string" || ticket.length > MAX_TICKET_LENGTH) throw invalidAttempt()
  const [payload, proof, extra] = ticket.split(".")
  if (extra !== undefined || !payload || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(proof || "")) throw invalidAttempt()
  if (!timingSafeEqual(Buffer.from(proof), Buffer.from(signature(payload)))) throw invalidAttempt()
  let attempt: PreparedNativePaymentAttempt
  try {
    attempt = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    throw invalidAttempt()
  }
  if (!attempt || Object.keys(attempt).length !== 12 || attempt.v !== 1 || typeof attempt.id !== "string" || !/^[a-f0-9-]{36}$/.test(attempt.id) ||
      !Number.isSafeInteger(attempt.issuedAt) || attempt.issuedAt < 0 || attempt.issuedAt > Date.now() || attempt.expiresAt !== attempt.issuedAt + PREPARED_NATIVE_PAYMENT_TTL_MS ||
      !validId(attempt.terminalId) || !validId(attempt.sessionId) || typeof attempt.readerId !== "string" || attempt.readerId.length > MAX_ID_LENGTH || !READER_PATTERN.test(attempt.readerId) ||
      !validId(attempt.purchaseId) || !validId(attempt.recipientUserId) || !validAmount(attempt.amount) || !validCurrency(attempt.currency) || !DIGEST_PATTERN.test(attempt.selectionDigest) || encode(attempt) !== payload) throw invalidAttempt()
  return attempt
}

export function readPreparedNativePaymentAttempt(ticket: unknown, caller?: PreparedNativePaymentCaller, options?: { requireFresh?: boolean }): PreparedNativePaymentAttempt {
  const attempt = decodedAttempt(ticket)
  if (caller && (!validId(caller.terminalId) || !validId(caller.sessionId))) throw invalidAttempt()
  if (caller && (attempt.terminalId !== caller.terminalId || attempt.sessionId !== caller.sessionId)) {
    throw new PreparedNativePaymentError("Prepared attempt belongs to another caller", "foreign_caller", 403)
  }
  if (options?.requireFresh && Date.now() >= attempt.expiresAt) {
    throw new PreparedNativePaymentError("Prepared attempt has expired", "expired_attempt", 409)
  }
  return attempt
}

export function preparedNativePaymentIdempotencyKey(purchase: PreparedNativePaymentPurchase) {
  assertPurchase(purchase)
  return `prepared-native-m2:v1:${purchase.idempotencyKey}`
}

function boundAttempt(ticket: unknown, purchase: PreparedNativePaymentPurchase) {
  const attempt = readPreparedNativePaymentAttempt(ticket)
  const bound = assertPurchase(purchase)
  if (attempt.purchaseId !== bound.id || attempt.recipientUserId !== bound.userId || attempt.amount !== bound.amount ||
      attempt.currency !== bound.currency || attempt.selectionDigest !== nativeFulfillmentMetadataDigest(bound.fulfillmentMetadata)) throw paymentMismatch()
  return attempt
}

export function preparedNativePaymentMetadata(ticket: unknown, purchase: PreparedNativePaymentPurchase): Record<string, string> {
  const attempt = boundAttempt(ticket, purchase)
  return {
    flowContext: FLOW, attemptId: attempt.id, purchaseId: attempt.purchaseId, recipientUserId: attempt.recipientUserId,
    terminalId: attempt.terminalId, actorSessionId: attempt.sessionId, readerId: attempt.readerId, selectionDigest: attempt.selectionDigest,
  }
}

export function validatePreparedNativePaymentIntent(intent: Stripe.PaymentIntent, ticket: unknown, purchase: PreparedNativePaymentPurchase) {
  const attempt = boundAttempt(ticket, purchase)
  const expected = preparedNativePaymentMetadata(ticket, purchase)
  const status = intent.status
  const allowedStatuses = new Set(["requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded"])
  if (intent.object !== "payment_intent" || intent.livemode !== true || intent.amount !== attempt.amount || intent.currency !== attempt.currency ||
      !allowedStatuses.has(status) || (status === "succeeded" && intent.amount_received !== attempt.amount) || intent.customer !== null || intent.receipt_email !== null ||
      !Array.isArray(intent.payment_method_types) || intent.payment_method_types.length !== 1 || intent.payment_method_types[0] !== "card_present" ||
      !intent.metadata || Object.keys(intent.metadata).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => intent.metadata[key] !== value)) throw paymentMismatch()
}
