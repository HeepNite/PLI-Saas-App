import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockCreatePaymentIntent = vi.fn()
const mockClearPreparedCheckout = vi.fn()

vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  enrollStudentPinForCheckout: (...args: unknown[]) => mockEnrollStudentPin(...args),
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
    process.env.STRIPE_SECRET_KEY = "sk_test"
    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
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
    mockEnrollStudentPin.mockResolvedValue({ ok: true, dbUserId: null })
    mockCreatePaymentIntent.mockResolvedValue({ client_secret: "pi_secret_123" })
  })

  it("returns client secret for valid request", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

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
    const req = new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "kiosk_terminal" }),
    })

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
    const req = new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prepareOnly: true,
        photoContext: "qr_phone",
      }),
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
    expect(mockEnrollStudentPin).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("clears prepared context after a successful card fast path", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const req = new Request("http://localhost/api/checkout/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoContext: "kiosk_terminal",
        kioskSessionToken: "kiosk_session_1",
      }),
    })

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
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
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
    const res = await POST(
      new Request("http://localhost/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

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

    consoleInfo.mockRestore()
  })

  it("logs card next-step latency within target", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(3_400)

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

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
})
