import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockCreateCheckoutSession = vi.fn()
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
    checkout = {
      sessions: {
        create: (...args: unknown[]) => mockCreateCheckoutSession(...args),
      },
    }
    constructor() {}
  },
}))

describe("checkout session route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    process.env.STRIPE_SECRET_KEY = "sk_test"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"

    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
    mockCreateCheckoutSession.mockReset()
    mockClearPreparedCheckout.mockReset()

    mockValidate.mockResolvedValue({
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
    mockCreateCheckoutSession.mockResolvedValue({
      id: "cs_test_123",
      url: "https://stripe.test/session",
      expires_at: 1_775_958_000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns checkout session url, sessionId, and expiresAt", async () => {
    const { POST } = await import("@/app/api/checkout/session/route")
    const req = new Request("http://localhost/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      url: "https://stripe.test/session",
      sessionId: "cs_test_123",
      expiresAt: "2026-04-12T01:40:00.000Z",
    })
  })

  it("uses shared account preparation and kiosk checkout metadata", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"))

    const { POST } = await import("@/app/api/checkout/session/route")
    const req = new Request("http://localhost/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoContext: "kiosk_terminal",
        firstName: "Test",
        lastName: "User",
        name: "Test User",
        phone: "+1 9293876584",
        email: "test@example.com",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockResolveCheckoutPreparation).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        name: "Test User",
        phone: "+1 9293876584",
      }),
      expect.objectContaining({
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
      })
    )

    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user_123",
        expires_at: 1_774_355_400,
        metadata: expect.objectContaining({
          flowContext: "kiosk_terminal",
          paymentSurface: "hosted_checkout",
        }),
      })
    )
    expect(mockClearPreparedCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalAuth: expect.objectContaining({ ok: true }),
      })
    )
  })

  it("enrolls a student PIN before creating checkout for new-student service", async () => {
    mockValidate.mockResolvedValueOnce({
      courseSlug: "salsa-femenina-matutina",
      courseTitle: "Course booking",
      amountInt: 2000,
      currency: "usd",
      date: "2026-02-10",
      time: "11:00",
      packageId: "",
      serviceId: "new-student",
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

    const { POST } = await import("@/app/api/checkout/session/route")
    await POST(
      new Request("http://localhost/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentPin: "1234", studentPinConfirm: "1234" }),
      })
    )

    expect(mockEnrollStudentPin).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "new-student",
        studentPin: "1234",
        studentPinConfirm: "1234",
      })
    )
  })

  it("falls back silently when prepared context is expired and still logs card latency", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(10_000)
      .mockReturnValueOnce(10_000)
      .mockReturnValueOnce(11_200)

    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      fallbackReason: "expired_prepared_context",
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

    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ url: "https://stripe.test/session" })
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-session",
      expect.objectContaining({
        segment: "card_next_step",
        source: "fallback",
        fallbackReason: "expired_prepared_context",
        durationMs: 1_200,
      })
    )

    consoleInfo.mockRestore()
    dateNow.mockRestore()
  })
})
