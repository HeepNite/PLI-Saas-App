import { describe, expect, it } from "vitest"

import {
  clearFailureFromMetadata,
  isStripeFailureInfo,
  mergeFailureIntoMetadata,
  normalizeFailureFromCheckoutSession,
  normalizeFailureFromPaymentIntent,
} from "@/lib/stripe-failure"

describe("normalizeFailureFromPaymentIntent", () => {
  const baseEvent = {
    type: "payment_intent.payment_failed",
    created: Math.floor(Date.now() / 1000),
  } as const

  it("extracts allowlisted fields from last_payment_error", () => {
    const intent = {
      id: "pi_failed_123",
      last_payment_error: {
        message: "Your card was declined.",
        code: "card_declined",
        decline_code: "insufficient_funds",
        type: "card_error",
        payment_method: {
          id: "pm_123",
          card: {
            brand: "visa",
            last4: "4242",
            fingerprint: "fp_secret_123",
          },
        },
        doc_url: "https://stripe.com/docs/error-codes",
      },
    } as const

    const result = normalizeFailureFromPaymentIntent(
      intent as never,
      baseEvent as never
    )

    expect(result.eventType).toBe("payment_intent.payment_failed")
    expect(result.paymentIntentId).toBe("pi_failed_123")
    expect(result.error).toEqual({
      message: "Your card was declined.",
      code: "card_declined",
      declineCode: "insufficient_funds",
      type: "card_error",
    })
    expect(result.card).toEqual({ brand: "visa", last4: "4242" })
    // PII dropped
    expect(result.error).not.toHaveProperty("doc_url")
    expect(result.card).not.toHaveProperty("fingerprint")
  })

  it("handles missing last_payment_error gracefully", () => {
    const intent = {
      id: "pi_failed_456",
      last_payment_error: null,
    } as const

    const result = normalizeFailureFromPaymentIntent(
      intent as never,
      baseEvent as never
    )

    expect(result.eventType).toBe("payment_intent.payment_failed")
    expect(result.paymentIntentId).toBe("pi_failed_456")
    expect(result.error).toBeUndefined()
    expect(result.card).toBeUndefined()
  })

  it("drops billing_details and other non-allowlisted fields", () => {
    const intent = {
      id: "pi_failed_789",
      last_payment_error: {
        message: "Declined",
        code: "generic_decline",
        type: "card_error",
        payment_method: {
          id: "pm_789",
          card: { brand: "mastercard", last4: "5555" },
          billing_details: {
            name: "John Doe",
            email: "john@example.com",
            address: { line1: "123 Main St" },
          },
        },
      },
    } as const

    const result = normalizeFailureFromPaymentIntent(
      intent as never,
      baseEvent as never
    )

    expect(result.card).toEqual({ brand: "mastercard", last4: "5555" })
    expect(result.card).not.toHaveProperty("billing_details")
    expect(result.error).not.toHaveProperty("payment_method")
  })
})

describe("normalizeFailureFromCheckoutSession", () => {
  const baseEvent = {
    type: "checkout.session.expired",
    created: Math.floor(Date.now() / 1000),
  } as const

  it("normalizes checkout.session.expired event", () => {
    const session = {
      id: "cs_expired_123",
      payment_intent: "pi_linked_123",
    } as const

    const result = normalizeFailureFromCheckoutSession(
      session as never,
      baseEvent as never
    )

    expect(result.eventType).toBe("checkout.session.expired")
    expect(result.checkoutSessionId).toBe("cs_expired_123")
    expect(result.paymentIntentId).toBe("pi_linked_123")
  })

  it("handles payment_intent as object", () => {
    const session = {
      id: "cs_expired_456",
      payment_intent: { id: "pi_obj_456" },
    } as const

    const result = normalizeFailureFromCheckoutSession(
      session as never,
      baseEvent as never
    )

    expect(result.paymentIntentId).toBe("pi_obj_456")
  })

  it("normalizes checkout.session.async_payment_failed event", () => {
    const session = {
      id: "cs_async_789",
      payment_intent: "pi_async_789",
    } as const

    const result = normalizeFailureFromCheckoutSession(
      session as never,
      { ...baseEvent, type: "checkout.session.async_payment_failed" } as never
    )

    expect(result.eventType).toBe("checkout.session.async_payment_failed")
    expect(result.checkoutSessionId).toBe("cs_async_789")
  })
})

describe("mergeFailureIntoMetadata", () => {
  const failure = {
    eventType: "payment_intent.payment_failed",
    occurredAt: "2026-04-25T12:00:00.000Z",
    paymentIntentId: "pi_123",
    error: { message: "Declined", code: "card_declined" },
  } as const

  it("preserves existing metadata keys", () => {
    const existing = {
      courseSlug: "bachata",
      userId: "user_123",
      paymentChannel: "card",
    }

    const result = mergeFailureIntoMetadata(existing, failure)

    expect(result.courseSlug).toBe("bachata")
    expect(result.userId).toBe("user_123")
    expect(result.paymentChannel).toBe("card")
    expect(result.stripeFailure).toEqual(failure)
  })

  it("replaces existing stripeFailure sub-object", () => {
    const existing = {
      courseSlug: "salsa",
      stripeFailure: { eventType: "old_event", occurredAt: "2025-01-01" },
    }

    const result = mergeFailureIntoMetadata(existing, failure)

    expect(result.stripeFailure).toEqual(failure)
    expect(result.courseSlug).toBe("salsa")
  })

  it("handles null existing metadata", () => {
    const result = mergeFailureIntoMetadata(null, failure)
    expect(result.stripeFailure).toEqual(failure)
  })

  it("handles undefined existing metadata", () => {
    const result = mergeFailureIntoMetadata(undefined, failure)
    expect(result.stripeFailure).toEqual(failure)
  })

  it("handles non-object existing metadata (e.g. array)", () => {
    const result = mergeFailureIntoMetadata(["unexpected"] as never, failure)
    expect(result.stripeFailure).toEqual(failure)
  })
})

describe("clearFailureFromMetadata", () => {
  it("removes only stripeFailure key", () => {
    const existing = {
      courseSlug: "bachata",
      userId: "user_123",
      stripeFailure: { eventType: "payment_intent.payment_failed" },
    }

    const result = clearFailureFromMetadata(existing)

    expect(result).toEqual({
      courseSlug: "bachata",
      userId: "user_123",
    })
    expect(result).not.toHaveProperty("stripeFailure")
  })

  it("returns undefined when metadata becomes empty", () => {
    const existing = {
      stripeFailure: { eventType: "payment_intent.payment_failed" },
    }

    const result = clearFailureFromMetadata(existing)

    expect(result).toBeUndefined()
  })

  it("returns undefined when input is null", () => {
    expect(clearFailureFromMetadata(null)).toBeUndefined()
  })

  it("returns undefined when input is undefined", () => {
    expect(clearFailureFromMetadata(undefined)).toBeUndefined()
  })

  it("preserves other keys when stripeFailure is absent", () => {
    const existing = { courseSlug: "salsa", userId: "user_456" }

    const result = clearFailureFromMetadata(existing)

    expect(result).toEqual({ courseSlug: "salsa", userId: "user_456" })
  })
})

describe("isStripeFailureInfo", () => {
  it("returns true for valid StripeFailureInfo with all fields", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      paymentIntentId: "pi_123",
      error: {
        message: "Your card was declined.",
        code: "card_declined",
        declineCode: "insufficient_funds",
        type: "card_error",
      },
      card: { brand: "visa", last4: "4242" },
    }

    expect(isStripeFailureInfo(value)).toBe(true)
  })

  it("returns true for minimal valid StripeFailureInfo", () => {
    const value = {
      eventType: "checkout.session.expired",
      occurredAt: "2026-04-25T12:00:00.000Z",
    }

    expect(isStripeFailureInfo(value)).toBe(true)
  })

  it("returns false for null", () => {
    expect(isStripeFailureInfo(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isStripeFailureInfo(undefined)).toBe(false)
  })

  it("returns false for non-object values", () => {
    expect(isStripeFailureInfo("string")).toBe(false)
    expect(isStripeFailureInfo(42)).toBe(false)
    expect(isStripeFailureInfo(true)).toBe(false)
  })

  it("returns false when eventType is missing", () => {
    const value = { occurredAt: "2026-04-25T12:00:00.000Z" }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when occurredAt is missing", () => {
    const value = { eventType: "payment_intent.payment_failed" }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when eventType is not a string", () => {
    const value = { eventType: 123, occurredAt: "2026-04-25T12:00:00.000Z" }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when error has non-string message", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      error: { message: 123 },
    }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when error is not an object", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      error: "not an object",
    }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when card has non-string brand", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      card: { brand: 123, last4: "4242" },
    }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns false when card is not an object", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      card: "not an object",
    }
    expect(isStripeFailureInfo(value)).toBe(false)
  })

  it("returns true when error is null (allowed)", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      error: null,
    }
    expect(isStripeFailureInfo(value)).toBe(true)
  })

  it("returns true when card is null (allowed)", () => {
    const value = {
      eventType: "payment_intent.payment_failed",
      occurredAt: "2026-04-25T12:00:00.000Z",
      card: null,
    }
    expect(isStripeFailureInfo(value)).toBe(true)
  })
})
