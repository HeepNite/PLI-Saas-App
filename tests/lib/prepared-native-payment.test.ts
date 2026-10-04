import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

const caller = { terminalId: "terminal_1", sessionId: "session_1" }
const purchase = {
  id: "purchase_1", userId: "user_1", amount: 2599, currency: "usd",
  idempotencyKey: "native-m2-prepared:purchase_1",
  fulfillmentMetadata: { courseSlug: "salsa", serviceId: "dropin", startsAt: "2026-10-04T17:00:00Z" },
}

const replaceClaim = (ticket: string, key: string, value: unknown) => {
  const [payload, proof] = ticket.split(".")
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  return `${Buffer.from(JSON.stringify({ ...claims, [key]: value })).toString("base64url")}.${proof}`
}
const expectError = (run: () => unknown, match: Record<string, unknown>) => {
  try { run() } catch (error) { expect(error).toMatchObject(match); return }
  throw new Error("Expected a typed prepared-native-payment error")
}

describe("prepared native payment proof", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-04T17:00:00.000Z"))
    vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("issues a native-only dynamic Purchase proof and derives stable Purchase-owned values", async () => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const ticket = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })
    const attempt = proof.readPreparedNativePaymentAttempt(ticket, caller, { requireFresh: true })

    expect(attempt).toMatchObject({ terminalId: caller.terminalId, sessionId: caller.sessionId, readerId: "tmr_reader_1",
      purchaseId: purchase.id, recipientUserId: purchase.userId, amount: 2599, currency: "usd",
      idempotencyDigest: createHash("sha256").update(purchase.idempotencyKey).digest("hex") })
    expect(proof.preparedNativePaymentIdempotencyKey(purchase)).toBe("prepared-native-m2:v1:native-m2-prepared:purchase_1")
    expect(proof.preparedNativePaymentIdempotencyKey({ ...purchase, id: "purchase_other" })).toBe(
      proof.preparedNativePaymentIdempotencyKey(purchase),
    )
    expect(proof.preparedNativePaymentMetadata(ticket, purchase)).toEqual(expect.objectContaining({
      purchaseIdempotencyDigest: attempt.idempotencyDigest,
    }))
    expect(proof.nativeFulfillmentMetadataDigest({ startsAt: "2026-10-04T17:00:00Z", serviceId: "dropin", courseSlug: "salsa" }))
      .toBe(attempt.selectionDigest)
  })

  it("uses code-unit metadata key ordering for mixed-case keys", async () => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const first = { aZ: "upper", aa: "lower" }
    const second = { aa: "lower", aZ: "upper" }

    expect(proof.nativeFulfillmentMetadataDigest(first)).toBe("40111e5ffb195a3324c49d3a29547df1821db20e4929fa1d0b0f787fcc1eb02c")
    expect(proof.nativeFulfillmentMetadataDigest(second)).toBe(proof.nativeFulfillmentMetadataDigest(first))
  })

  it.each([
    ["amount", 1], ["currency", "eur"], ["purchaseId", "purchase_other"], ["recipientUserId", "user_other"],
    ["selectionDigest", "a".repeat(64)], ["idempotencyDigest", "a".repeat(64)], ["readerId", "tmr_other"],
  ])("rejects a tampered %s claim with a sanitized typed error", async (key, value) => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const ticket = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })

    expectError(() => proof.readPreparedNativePaymentAttempt(replaceClaim(ticket, key, value), caller), {
      name: proof.PreparedNativePaymentError.name, code: "invalid_attempt", status: 400,
    })
  })

  it("rejects oversized, foreign, future, and fresh-expired proofs without exposing claims", async () => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const ticket = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })
    expectError(() => proof.readPreparedNativePaymentAttempt("x".repeat(2001)), { code: "invalid_attempt", status: 400 })
    expectError(() => proof.readPreparedNativePaymentAttempt(ticket, { terminalId: "other", sessionId: caller.sessionId }), {
      code: "foreign_caller", status: 403,
    })
    vi.setSystemTime(new Date("2026-10-04T17:01:00.000Z"))
    const future = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })
    vi.setSystemTime(new Date("2026-10-04T17:00:00.000Z"))
    expectError(() => proof.readPreparedNativePaymentAttempt(future, caller), { code: "invalid_attempt", status: 400 })
    vi.setSystemTime(new Date("2026-10-04T17:05:00.000Z"))
    expect(() => proof.readPreparedNativePaymentAttempt(ticket, caller)).not.toThrow()
    expectError(() => proof.readPreparedNativePaymentAttempt(ticket, caller, { requireFresh: true }), {
      code: "expired_attempt", status: 409,
    })
  })

  it("rejects unsupported fulfillment metadata and invalid Purchase idempotency keys", async () => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    expectError(() => proof.nativeFulfillmentMetadataDigest({ courseSlug: " salsa " }), { code: "invalid_purchase" })
    expectError(() => proof.nativeFulfillmentMetadataDigest({ courseSlug: ["salsa"] }), { code: "invalid_purchase" })
    expectError(() => proof.preparedNativePaymentIdempotencyKey({ ...purchase, idempotencyKey: "" }), { code: "invalid_purchase" })
    expectError(() => proof.preparedNativePaymentIdempotencyKey({ ...purchase, idempotencyKey: "x".repeat(181) }), { code: "invalid_purchase" })
  })

  it.each([
    ["mode", { livemode: false }], ["type", { payment_method_types: ["card"] }], ["status", { status: "succeeded", amount_received: 1 }],
    ["customer", { customer: "cus_1" }], ["receipt", { receipt_email: "student@example.test" }],
    ["metadata", { metadata: { extra: "unexpected" } }], ["purchase", { metadata: { purchaseId: "purchase_other" } }],
    ["recipient", { metadata: { recipientUserId: "user_other" } }], ["terminal", { metadata: { terminalId: "terminal_other" } }],
    ["session", { metadata: { actorSessionId: "session_other" } }], ["reader", { metadata: { readerId: "tmr_other" } }],
    ["digest", { metadata: { selectionDigest: "a".repeat(64) } }],
    ["idempotency digest", { metadata: { purchaseIdempotencyDigest: "a".repeat(64) } }],
  ])("rejects provider %s substitutions", async (_case, override) => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const ticket = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })
    const metadata = proof.preparedNativePaymentMetadata(ticket, purchase)
    const supplied = override as { metadata?: Record<string, string> }
    const intent = {
      object: "payment_intent", livemode: true, amount: purchase.amount, currency: purchase.currency, amount_received: 0,
      status: "requires_payment_method", customer: null, receipt_email: null, payment_method_types: ["card_present"],
      ...override, metadata: { ...metadata, ...supplied.metadata },
    } as Stripe.PaymentIntent
    expectError(() => proof.validatePreparedNativePaymentIntent(intent, ticket, purchase), {
      name: proof.PreparedNativePaymentError.name, code: "payment_mismatch", status: 409,
    })
  })

  it("accepts only exact LIVE card-present metadata bound to the signed Purchase", async () => {
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const ticket = proof.issuePreparedNativePaymentAttempt(caller, { readerId: "tmr_reader_1", purchase })
    const intent = {
      object: "payment_intent", livemode: true, amount: purchase.amount, currency: purchase.currency, amount_received: purchase.amount,
      status: "succeeded", customer: null, receipt_email: null, payment_method_types: ["card_present"],
      metadata: proof.preparedNativePaymentMetadata(ticket, purchase),
    } as Stripe.PaymentIntent
    expect(() => proof.validatePreparedNativePaymentIntent(intent, ticket, purchase)).not.toThrow()
    expectError(() => proof.preparedNativePaymentMetadata(ticket, { ...purchase, amount: 1 }), { code: "payment_mismatch" })
    expectError(() => proof.preparedNativePaymentMetadata(ticket, { ...purchase, idempotencyKey: "native-m2-prepared:changed" }), {
      code: "payment_mismatch",
    })
  })
})
