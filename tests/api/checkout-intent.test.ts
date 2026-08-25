import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockCreatePaymentIntent = vi.fn()
const mockClearPreparedCheckout = vi.fn()

const ENV_KEYS = [
  "NEST_GATEWAY_ENABLED",
  "NEST_GATEWAY_ROUTE_TERMINAL_PAYMENT_INTENTS_ENABLED",
  "NEST_BACKEND_INTERNAL_URL",
  "NEST_GATEWAY_SHARED_SECRET",
  "STRIPE_SECRET_KEY",
] as const

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const createRouteRequest = (body: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/checkout/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function enableTerminalPaymentGateway() {
  process.env.NEST_GATEWAY_ENABLED = "true"
  process.env.NEST_GATEWAY_ROUTE_TERMINAL_PAYMENT_INTENTS_ENABLED = "true"
  process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
  process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"
}

vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  clearPreparedCheckoutAfterSuccess: (...args: unknown[]) => mockClearPreparedCheckout(...args),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    paymentIntents = {
      create: (...args: unknown[]) => mockCreatePaymentIntent(...args),
    }
    constructor() {}
  },
}))

describe("checkout intent route", () => {
  beforeEach(() => {
    vi.resetModules()
    restoreEnv()
    process.env.STRIPE_SECRET_KEY = "sk_test"
    delete process.env.NEST_GATEWAY_ENABLED
    delete process.env.NEST_GATEWAY_ROUTE_TERMINAL_PAYMENT_INTENTS_ENABLED
    delete process.env.NEST_BACKEND_INTERNAL_URL
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockCreatePaymentIntent.mockReset()
    mockClearPreparedCheckout.mockReset()

    mockValidate.mockReturnValue({
      courseSlug: "salsa-femenina-matutina",
      courseTitle: "Course booking",
      amountInt: 2000,
      currency: "usd",
      date: "2026-02-10",
      time: "11:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      pkg: null,
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
    })
    mockResolveCheckoutPreparation.mockResolvedValue({
      source: "prepared",
      preparedContextId: "prepared_ctx_1",
      terminalAuth: {
        ok: true,
        sessionId: "terminal_session_1",
        terminal: {
          id: "terminal_1",
          slug: "terminal-1",
          name: "Terminal 1",
          location: null,
          defaultCourseSlug: null,
          active: true,
        },
      },
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: {
          resolvedEmail: "test@example.com",
          phoneRaw: "+1 9293876584",
          phoneNormalized: "9293876584",
        },
        account: {
          clerkUserId: "user_123",
          created: false,
          requiresSignIn: false,
          hasAvatar: false,
        },
      },
    })
    mockEnforceNewStudent.mockResolvedValue(null)
    mockCreatePaymentIntent.mockResolvedValue({ client_secret: "pi_secret_123" })
  })

  afterEach(() => {
    restoreEnv()
    vi.unstubAllGlobals()
  })

  it("returns client secret for valid request", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = createRouteRequest()

    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.clientSecret).toBe("pi_secret_123")
    expect(data.account).toMatchObject({
      clerkUserId: "user_123",
      hasAvatar: false,
    })
    expect(mockEnforceNewStudent).toHaveBeenCalledTimes(1)
    expect(mockCreatePaymentIntent).toHaveBeenCalledTimes(1)
  })

  it("uses authoritative kiosk current-course date/time in payment intent metadata", async () => {
    mockValidate.mockReturnValueOnce({
      courseSlug: "salsa-timba-ny",
      courseTitle: "Salsa timba in New York",
      amountInt: 2000,
      currency: "usd",
      date: "2026-05-13",
      time: "22:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      pkg: null,
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      kioskCurrentCourseDate: "2026-05-06",
      kioskCurrentCourseTime: "22:00",
    })

    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = createRouteRequest({ photoContext: "kiosk_terminal" })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          date: "2026-05-06",
          time: "22:00",
        }),
      })
    )
  })

  it("supports prepareOnly without creating a payment intent", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = createRouteRequest({
      prepareOnly: true,
      photoContext: "qr_phone",
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      prepareOnly: true,
      account: {
        clerkUserId: "user_123",
        hasAvatar: false,
      },
    })
    expect(mockResolveCheckoutPreparation).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Object),
      expect.objectContaining({
        photoContext: "qr_phone",
        allowExistingAccountLookup: true,
      })
    )
    expect(mockEnforceNewStudent).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("delegates prepared kiosk terminal intents to Nest with deterministic idempotency and class metadata", async () => {
    enableTerminalPaymentGateway()

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ clientSecret: "nest_pi_secret" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { INTERNAL_AUTH_HEADER, REQUEST_ID_HEADER } = await import("@/lib/nest-gateway/auth")
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ clientSecret: "nest_pi_secret" })
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()

    expect(fetchMock).toHaveBeenCalledWith(
      "http://nest.internal/internal/terminal/payment-intents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: "shared-secret",
          [REQUEST_ID_HEADER]: "terminal-payment-intent:prepared_ctx_1:2000:usd",
        }),
      })
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const gatewayPayload = JSON.parse(String(init.body)) as { metadata: Record<string, string> }

    expect(gatewayPayload).toMatchObject({
      amount: 2000,
      currency: "usd",
      idempotencyKey: "terminal-payment-intent:prepared_ctx_1:2000:usd",
      metadata: expect.objectContaining({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-10",
        time: "11:00",
        flowContext: "kiosk_terminal",
      }),
    })
    expect(gatewayPayload.metadata).not.toHaveProperty("packageId")
    expect(gatewayPayload.metadata).not.toHaveProperty("packageLabel")
    expect(gatewayPayload.metadata).not.toHaveProperty("coupon")
    expect(gatewayPayload.metadata).not.toHaveProperty("name")
    expect(gatewayPayload.metadata).not.toHaveProperty("phoneRaw")
    expect(gatewayPayload.metadata).not.toHaveProperty("consecutivePriceCents")
    expect(gatewayPayload.metadata).not.toHaveProperty("consecutiveLinkedCourseSlug")
    expect(gatewayPayload.metadata).not.toHaveProperty("consecutiveCourseTitle")
    expect(gatewayPayload.metadata).not.toHaveProperty("consecutiveLinkedCourseTime")
  })

  it("clears prepared context after a successful card fast path", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockClearPreparedCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        kioskSessionToken: "kiosk_session_1",
        terminalAuth: expect.objectContaining({ ok: true }),
      })
    )
  })

  it("falls back silently when prepared context is missing", async () => {
    enableTerminalPaymentGateway()

    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      fallbackReason: "missing_prepared_context",
      terminalAuth: {
        ok: true,
        sessionId: "terminal_session_1",
        terminal: {
          id: "terminal_1",
          slug: "terminal-1",
          name: "Terminal 1",
          location: null,
          defaultCourseSlug: null,
          active: true,
        },
      },
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: {
          resolvedEmail: "test@example.com",
          phoneRaw: "+1 9293876584",
          phoneNormalized: "9293876584",
        },
        account: {
          clerkUserId: "user_123",
          created: false,
          requiresSignIn: false,
          hasAvatar: false,
        },
      },
    })

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ clientSecret: "pi_secret_123" })
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-intent",
      expect.objectContaining({
        segment: "card_next_step",
        source: "fallback",
        fallbackReason: "missing_prepared_context",
      })
    )
    expect(fetchMock).not.toHaveBeenCalled()

    consoleInfo.mockRestore()
  })

  it("returns a bounded error and does not fall back locally when a delegated Nest attempt ends in unknown state", async () => {
    enableTerminalPaymentGateway()

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("nest timed out")))

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({
      error: "Payment intent status is unknown. Verify the terminal payment before retrying.",
    })
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("treats a blank Nest clientSecret as unknown state and blocks local fallback", async () => {
    enableTerminalPaymentGateway()

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ clientSecret: "   " }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({
      error: "Payment intent status is unknown. Verify the terminal payment before retrying.",
    })
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("logs card next-step latency within target", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(3_400)

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(200)
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-intent",
      expect.objectContaining({
        segment: "card_next_step",
        durationMs: 1_400,
      })
    )
    expect(1_400).toBeLessThanOrEqual(STAFF_TERMINAL_LATENCY_TARGETS_MS.cardNextStep)

    consoleInfo.mockRestore()
    dateNow.mockRestore()
  })

  it("does not clear prepared context when delegated checkout falls back locally and Stripe is not configured", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TERMINAL_PAYMENT_INTENTS_ENABLED = "true"
    delete process.env.NEST_BACKEND_INTERNAL_URL
    delete process.env.NEST_GATEWAY_SHARED_SECRET
    delete process.env.STRIPE_SECRET_KEY

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: "Stripe not configured" })
    expect(mockClearPreparedCheckout).not.toHaveBeenCalled()
  })
})
