import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockCreateCheckoutSession = vi.fn()
const mockRetrieveCheckoutSession = vi.fn()
const mockExpireCheckoutSession = vi.fn()
const mockClearPreparedCheckout = vi.fn()
const mockResolveSpecialClassIdentity = vi.fn()
const mockAdmitSpecialClassReservation = vi.fn()
const mockUpdateSpecialClassPurchaseSession = vi.fn()
const mockFailSpecialClassHold = vi.fn()
const mockPreserveSpecialClassHold = vi.fn()

vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  enrollStudentPinForCheckout: (...args: unknown[]) => mockEnrollStudentPin(...args),
  clearPreparedCheckoutAfterSuccess: (...args: unknown[]) => mockClearPreparedCheckout(...args),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("@/lib/checkout/special-class-identity", () => ({
  resolveSpecialClassIdentity: (...args: unknown[]) => mockResolveSpecialClassIdentity(...args),
}))

vi.mock("@/lib/checkout/special-class-reservation", () => ({
  admitSpecialClassReservation: (...args: unknown[]) => mockAdmitSpecialClassReservation(...args),
  updateSpecialClassPurchaseSession: (...args: unknown[]) => mockUpdateSpecialClassPurchaseSession(...args),
  failSpecialClassHold: (...args: unknown[]) => mockFailSpecialClassHold(...args),
  preserveSpecialClassHold: (...args: unknown[]) => mockPreserveSpecialClassHold(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        create: (...args: unknown[]) => mockCreateCheckoutSession(...args),
        retrieve: (...args: unknown[]) => mockRetrieveCheckoutSession(...args),
        expire: (...args: unknown[]) => mockExpireCheckoutSession(...args),
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
    mockRetrieveCheckoutSession.mockReset()
    mockExpireCheckoutSession.mockReset()
    mockClearPreparedCheckout.mockReset()
    mockResolveSpecialClassIdentity.mockReset()
    mockAdmitSpecialClassReservation.mockReset()
    mockUpdateSpecialClassPurchaseSession.mockReset()
    mockFailSpecialClassHold.mockReset()
    mockPreserveSpecialClassHold.mockReset()

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
    mockResolveSpecialClassIdentity.mockResolvedValue({
      ok: true,
      clerkUserId: "clerk_special_1",
      dbUserId: "db_special_1",
      stripeCustomerId: null,
      email: "ada@example.com",
      phone: "+12015550123",
      name: "Ada Lovelace",
    })
    mockAdmitSpecialClassReservation.mockResolvedValue({
      ok: true,
      kind: "created",
      idempotencyKey: "special-salsa-class-2026-08-30:c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
      holdExpiresAt: new Date(1_775_958_000 * 1000),
      purchase: { id: "purchase_special_1", amount: 2000, status: "pending", stripeCheckoutSessionId: null },
    })
    mockUpdateSpecialClassPurchaseSession.mockResolvedValue({})
    mockFailSpecialClassHold.mockResolvedValue({ count: 1 })
    mockPreserveSpecialClassHold.mockResolvedValue({ count: 1 })
    mockExpireCheckoutSession.mockResolvedValue({ status: "expired" })
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

  it("uses authoritative kiosk current-course date/time in checkout session metadata", async () => {
    mockValidate.mockResolvedValueOnce({
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

    const { POST } = await import("@/app/api/checkout/session/route")
    const req = new Request("http://localhost/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "kiosk_terminal" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          date: "2026-05-06",
          time: "22:00",
        }),
      })
    )
  })

  // Student PIN enrollment was removed from all student-facing checkout flows
  // (commit 8edb5ca). Even when a studentPin is supplied for a new-student
  // service, the checkout route must NOT enroll a PIN.
  it("does not enroll a student PIN for new-student service (student PIN removed)", async () => {
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
    const res = await POST(
      new Request("http://localhost/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentPin: "1234", studentPinConfirm: "1234" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockEnrollStudentPin).not.toHaveBeenCalled()
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1)
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

  it("creates a server-authoritative special class checkout and ignores tampered event fields", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-23T20:00:00.987Z"))
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({
      ok: true,
      kind: "created",
      idempotencyKey: "special-salsa-class-2026-08-30:c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
      holdExpiresAt: new Date("2026-08-23T20:03:01.000Z"),
      purchase: { id: "purchase_special_1", amount: 2000, status: "pending", stripeCheckoutSessionId: null },
    })
    mockCreateCheckoutSession.mockResolvedValueOnce({
      id: "cs_test_123",
      url: "https://stripe.test/session",
      expires_at: 1_787_518_800,
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
        amount: 1,
        currency: "eur",
        capacity: 999,
        date: "2030-01-01",
      }),
    }))

    expect(res.status).toBe(200)
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockAdmitSpecialClassReservation).toHaveBeenCalledWith(
      expect.objectContaining({ specialClassSlug: "special-salsa-class-2026-08-30" }),
      expect.objectContaining({ now: expect.any(Function) }),
    )
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer_creation: "always",
        success_url: "http://localhost:3000/special-classes/special-salsa-class-2026-08-30/confirmation?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/special-classes/special-salsa-class-2026-08-30?checkout=cancelled&attempt=c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        payment_method_types: ["card"],
        payment_intent_data: {
          capture_method: "manual",
          metadata: {
            specialClassId: "special-salsa-class-2026-08-30",
            specialClassSlug: "special-salsa-class-2026-08-30",
            classSessionId: "",
            attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
            lockedAmountCents: "2000",
            purchaseId: "purchase_special_1",
          },
        },
        line_items: [{
          quantity: 1,
          price_data: expect.objectContaining({ currency: "usd", unit_amount: 2000 }),
        }],
        metadata: expect.objectContaining({
          specialClassId: "special-salsa-class-2026-08-30",
          specialClassSlug: "special-salsa-class-2026-08-30",
          lockedAmountCents: "2000",
          courseSlug: "special-salsa-calena-2026-08-30",
          date: "2026-08-30",
          time: "20:00",
        }),
      }),
      { idempotencyKey: "special-salsa-class-2026-08-30:c6c05f53-2cc6-4a78-a35e-61daf6f13cb2" },
    )
    expect(mockUpdateSpecialClassPurchaseSession).toHaveBeenCalledWith("purchase_special_1", "cs_test_123")
  })

  it("releases the special class hold when Stripe does not return a checkout URL", async () => {
    mockCreateCheckoutSession.mockResolvedValueOnce({
      id: "cs_test_without_url",
      url: null,
      expires_at: 1_775_958_000,
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: "CHECKOUT_UNAVAILABLE" })
    expect(mockFailSpecialClassHold).toHaveBeenCalledWith("purchase_special_1")
    expect(mockUpdateSpecialClassPurchaseSession).not.toHaveBeenCalled()
  })

  it("reuses the open Stripe Session for a repeated special checkout attempt", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-30T14:00:00.000Z"))
    const recoveredExpiry = Math.floor(new Date("2026-08-30T14:29:59.000Z").getTime() / 1000)
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({
      ok: true,
      kind: "existing",
      idempotencyKey: "special-key",
      holdExpiresAt: new Date(recoveredExpiry * 1000),
      purchase: { id: "purchase_special_1", amount: 2000, status: "pending", stripeCheckoutSessionId: "cs_existing" },
    })
    mockRetrieveCheckoutSession.mockResolvedValueOnce({
      id: "cs_existing",
      url: "https://stripe.test/existing",
      status: "open",
      expires_at: recoveredExpiry,
      amount_total: 2000,
      currency: "usd",
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    await expect(res.json()).resolves.toMatchObject({ sessionId: "cs_existing", url: "https://stripe.test/existing" })
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it("reuses a recovered open Stripe Session independently of the internal hold expiry value", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((1_777_146_200 - 60) * 1000))
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({
      ok: true,
      kind: "existing",
      idempotencyKey: "special-key",
      holdExpiresAt: new Date(1_777_146_200 * 1000),
      purchase: { id: "purchase_special_1", amount: 2000, status: "pending", stripeCheckoutSessionId: "cs_mismatched" },
    })
    mockRetrieveCheckoutSession.mockResolvedValueOnce({
      id: "cs_mismatched",
      url: "https://stripe.test/mismatched",
      status: "open",
      expires_at: 1_777_146_201,
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ sessionId: "cs_mismatched", url: "https://stripe.test/mismatched" })
    expect(mockExpireCheckoutSession).not.toHaveBeenCalled()
    expect(mockFailSpecialClassHold).not.toHaveBeenCalled()
  })

  it("never compares a recovered Stripe Session expiry to the internal lease", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((1_777_146_200 - 60) * 1000))
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({
      ok: true,
      kind: "existing",
      idempotencyKey: "special-key",
      holdExpiresAt: new Date(1_777_146_200 * 1000),
      purchase: {
        id: "purchase_special_1",
        amount: 2000,
        status: "pending",
        stripeCheckoutSessionId: "cs_mismatched",
        metadata: { attemptId: "attempt_1", holdExpiresAt: new Date(1_777_146_200 * 1000).toISOString() },
      },
    })
    mockRetrieveCheckoutSession.mockResolvedValueOnce({
      id: "cs_mismatched",
      url: "https://stripe.test/mismatched",
      status: "open",
      expires_at: 1_777_146_260,
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ sessionId: "cs_mismatched" })
    expect(mockExpireCheckoutSession).not.toHaveBeenCalled()
    expect(mockFailSpecialClassHold).not.toHaveBeenCalled()
    expect(mockPreserveSpecialClassHold).not.toHaveBeenCalled()
  })

  it("never sends the internal three-minute lease as Stripe expires_at", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((1_775_958_000 - 60) * 1000))
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({
      ok: true,
      kind: "created",
      idempotencyKey: "special-key",
      holdExpiresAt: new Date(1_775_958_000 * 1000),
      purchase: {
        id: "purchase_special_1",
        amount: 2000,
        status: "pending",
        stripeCheckoutSessionId: null,
        metadata: { attemptId: "attempt_1", holdExpiresAt: new Date(1_775_958_000 * 1000).toISOString() },
      },
    })
    mockCreateCheckoutSession.mockResolvedValueOnce({
      id: "cs_new_mismatched",
      url: "https://stripe.test/new-mismatched",
      expires_at: 1_775_958_060,
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(200)
    const createPayload = mockCreateCheckoutSession.mock.calls[0][0]
    expect(createPayload).not.toHaveProperty("expires_at")
    expect(createPayload.payment_intent_data.capture_method).toBe("manual")
  })

  it("returns an expired-attempt response without creating a Stripe Session", async () => {
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({ ok: false, code: "CHECKOUT_EXPIRED" })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ code: "CHECKOUT_EXPIRED" })
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it("reuses a durable Stripe Customer instead of requesting another", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((1_775_958_000 - 60) * 1000))
    mockResolveSpecialClassIdentity.mockResolvedValueOnce({
      ok: true,
      clerkUserId: "clerk_special_1",
      dbUserId: "db_special_1",
      stripeCustomerId: "cus_existing",
      email: "ada@example.com",
      phone: "+12015550123",
      name: "Ada Lovelace",
    })
    const { POST } = await import("@/app/api/checkout/session/route")
    const res = await POST(new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    }))

    expect(res.status).toBe(200)
    const params = mockCreateCheckoutSession.mock.calls[0]?.[0]
    expect(params).toMatchObject({ customer: "cus_existing" })
    expect(params).not.toHaveProperty("customer_creation")
    expect(params).not.toHaveProperty("customer_email")
  })

  it("maps special capacity and identity conflicts to generic public errors", async () => {
    mockResolveSpecialClassIdentity.mockResolvedValueOnce({ ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" })
    const { POST } = await import("@/app/api/checkout/session/route")
    const request = () => new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        checkoutKind: "special-salsa-class",
        attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+12015550123",
      }),
    })
    const conflict = await POST(request())
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({
      code: "CONTACT_DETAILS_UNAVAILABLE",
      error: "We could not use those contact details. Please verify them and try again.",
    })

    mockResolveSpecialClassIdentity.mockResolvedValueOnce({
      ok: true,
      clerkUserId: "clerk_special_1",
      dbUserId: "db_special_1",
      stripeCustomerId: null,
      email: "ada@example.com",
      phone: "+12015550123",
      name: "Ada Lovelace",
    })
    mockAdmitSpecialClassReservation.mockResolvedValueOnce({ ok: false, code: "SOLD_OUT" })
    const soldOut = await POST(request())
    expect(soldOut.status).toBe(409)
    await expect(soldOut.json()).resolves.toMatchObject({ code: "SOLD_OUT" })
  })
})
