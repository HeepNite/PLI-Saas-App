import "server-only"
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import type Stripe from "stripe"

export const approvedInternalPurchase = Object.freeze({
  accountId: "acct_1PWRzcRtYdjwed35", productId: "prod_VJV0rf6b1sjK9x",
  priceId: "price_1UIs02RtYdjwed35ZB3jho1F", locationId: "tml_GqQ6wPY5rSAhAt",
  amount: 100, currency: "usd", livemode: true,
})
const FLOW = "pli_internal_purchase_v1"
const WINDOW_MS = 60 * 60 * 1000 // Never replay creates near Stripe's minimum 24-hour retention boundary.
type Caller = { terminalId: string; sessionId: string }
type Attempt = Caller & { v: 2; id: string; issuedAt: number; expiresAt: number; readerId: string; userId: string }
export type InternalPurchaseRequest =
  | { action: "preflight" | "connection-token" }
  | { action: "student-lookup"; phone: string }
  | { action: "attempt"; phone: string }
  | { action: "payment-intent"; ticket: string; paymentIntentId?: string }
  | { action: "recover"; ticket: string; paymentIntentId: string }

export class InternalPurchaseError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message)
  }
}
export const internalPaymentEnabled = () => process.env.INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED === "true"
// Rollback control for the independently deployable reversal path. It remains
// opt-in until configuration approval; disabled reversals are tombstoned for
// manual resolution by the webhook without contacting Stripe or credits.
export const internalPurchaseCreditReversalEnabled = () =>
  process.env.INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED === "true"
export const internalAttemptSigningKey = () => {
  const key = process.env.INTERNAL_PURCHASE_ATTEMPT_SECRET?.trim()
  if (!key || Buffer.byteLength(key) < 32) throw new InternalPurchaseError("Attempt signing credential is not configured")
  return key
}
const signature = (payload: string) => createHmac("sha256", internalAttemptSigningKey())
  .update(`${FLOW}:${JSON.stringify(approvedInternalPurchase)}:${payload}`).digest("base64url")

export const issueInternalAttempt = (caller: Caller, readerId: string, userId: string) => {
  if (!userId.trim()) throw new InternalPurchaseError("Selected student is invalid", 400)
  const issuedAt = Date.now()
  const payload = Buffer.from(JSON.stringify({ v: 2, id: randomUUID(), issuedAt, expiresAt: issuedAt + WINDOW_MS,
    terminalId: caller.terminalId, sessionId: caller.sessionId, readerId, userId })).toString("base64url")
  const ticket = `${payload}.${signature(payload)}`
  if (ticket.length > 500) throw new InternalPurchaseError("Attempt identity exceeds provider metadata limits")
  return ticket
}

export const readInternalAttempt = (ticket: string, caller?: Caller): Attempt => {
  const invalid = () => new InternalPurchaseError("Invalid internal attempt ticket", 400)
  if (typeof ticket !== "string" || ticket.length > 500) throw invalid()
  const [payload, proof, extra] = ticket.split(".")
  if (extra !== undefined || !payload || !/^[\w-]{43}$/.test(proof || "")) throw invalid()
  if (!timingSafeEqual(Buffer.from(proof), Buffer.from(signature(payload)))) throw invalid()
  let attempt: Attempt
  try {
    attempt = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    throw invalid()
  }
  if (!attempt || Object.keys(attempt).length !== 8 || attempt.v !== 2 ||
      typeof attempt.id !== "string" || !/^[a-f0-9-]{36}$/.test(attempt.id) || !Number.isSafeInteger(attempt.issuedAt) ||
      attempt.expiresAt !== attempt.issuedAt + WINDOW_MS ||
      attempt.issuedAt < 0 || attempt.issuedAt > Date.now() || typeof attempt.readerId !== "string" || !/^tmr_[a-zA-Z0-9]+$/.test(attempt.readerId) ||
      typeof attempt.terminalId !== "string" || !attempt.terminalId || typeof attempt.sessionId !== "string" || !attempt.sessionId ||
      typeof attempt.userId !== "string" || !attempt.userId) throw invalid()
  if (caller && (attempt.terminalId !== caller.terminalId || attempt.sessionId !== caller.sessionId)) {
    throw new InternalPurchaseError("Attempt belongs to another terminal or actor", 403)
  }
  return attempt
}
export const internalAttemptExpiry = (attempt: Attempt) => attempt.expiresAt
export const requireFreshInternalAttempt = (attempt: Attempt) => {
  if (Date.now() >= internalAttemptExpiry(attempt)) throw new InternalPurchaseError("Attempt expired; reconcile the existing payment, never replace it", 409)
}
export const internalAttemptKey = (ticket: string) => `internal-purchase:v1:${createHash("sha256").update(ticket).digest("hex")}`
export const internalIntentMetadata = (ticket: string, purchaseId?: string): Record<string, string> => {
  const attempt = readInternalAttempt(ticket)
  const approved = approvedInternalPurchase
  const resolvedPurchaseId = purchaseId || ""
  if (!resolvedPurchaseId.trim() || resolvedPurchaseId.length > 200) throw new InternalPurchaseError("Internal purchase identity is invalid", 409)
  return { flowContext: FLOW, pliInternalAttempt: ticket, attemptId: attempt.id,
    terminalId: attempt.terminalId, actorSessionId: attempt.sessionId, readerId: attempt.readerId, recipientUserId: attempt.userId,
    purchaseId: resolvedPurchaseId,
    accountId: approved.accountId, productId: approved.productId, priceId: approved.priceId, locationId: approved.locationId,
    purpose: "internal_purchase_one_general_class_credit" }
}
export const validateInternalIntent = (intent: Stripe.PaymentIntent, ticket: string, purchaseId?: string) => {
  const expected = internalIntentMetadata(ticket, purchaseId || intent.metadata?.purchaseId)
  if (intent.object !== "payment_intent" || intent.livemode !== true ||
      intent.amount !== approvedInternalPurchase.amount || intent.currency !== approvedInternalPurchase.currency ||
      intent.customer !== null || intent.receipt_email !== null || intent.payment_method_types.length !== 1 ||
      intent.payment_method_types[0] !== "card_present" || (intent.status === "succeeded" && intent.amount_received !== approvedInternalPurchase.amount) ||
      Object.keys(intent.metadata).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, value]) => intent.metadata[key] !== value)) {
    throw new InternalPurchaseError("Internal payment ownership or binding mismatch; reconcile manually", 409)
  }
}

// Call only after Stripe signature verification; this is independent of feature flags and ticket expiry.
export const isVerifiedInternalPaymentEvent = (event: Stripe.Event) => {
  if (!event.type.startsWith("payment_intent.")) return false
  const intent = event.data.object as Stripe.PaymentIntent
  const metadata = intent.metadata || {}
  if (metadata.flowContext !== FLOW && !Object.hasOwn(metadata, "pliInternalAttempt")) return false
  if (event.livemode !== true || (event.account && event.account !== approvedInternalPurchase.accountId)) {
    throw new InternalPurchaseError("Internal event merchant or mode mismatch", 400)
  }
  validateInternalIntent(intent, metadata.pliInternalAttempt)
  return true
}

export const parseInternalPurchaseRequest = (body: unknown): InternalPurchaseRequest | null => {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.hasOwn(body, "action")) return null
  const input = body as Record<string, unknown>
  const { action, ticket, paymentIntentId } = input
  if (typeof action !== "string") return null
  if (["preflight", "connection-token"].includes(action)) {
    return Object.keys(input).length === 1 ? input as InternalPurchaseRequest : null
  }
  if (action === "student-lookup") {
    return Object.keys(input).length === 2 && typeof input.phone === "string" && input.phone.trim().length >= 6 && input.phone.length <= 32
      ? input as InternalPurchaseRequest : null
  }
  if (action === "attempt") {
    return Object.keys(input).length === 2 && typeof input.phone === "string" && input.phone.trim().length >= 6 && input.phone.length <= 32
      ? input as InternalPurchaseRequest : null
  }
  if (action !== "payment-intent" && action !== "recover") return null
  if (Object.keys(input).some((key) => !["action", "ticket", "paymentIntentId"].includes(key))) return null
  if (typeof ticket !== "string" || !ticket || ticket.length > 500) return null
  if (action === "recover" || Object.hasOwn(input, "paymentIntentId")) {
    if (typeof paymentIntentId !== "string" || !/^pi_[a-zA-Z0-9]+$/.test(paymentIntentId)) return null
  }
  return input as InternalPurchaseRequest
}
