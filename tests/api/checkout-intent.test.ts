import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockCreatePaymentIntent = vi.fn()
const mockClearPreparedCheckout = vi.fn()
const mockFindHeritagePinEntitlement = vi.fn()
const mockCreateOrReuseNativePreparedPurchase = vi.fn()
const mockIssuePreparedNativePurchase = vi.fn()
const mockCreatePreparedCheckoutContext = vi.fn()
const mockIsPreparedCheckoutContextEnabled = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
class MockNativePreparedPurchaseError extends Error {}
class MockPreparedNativePurchaseError extends Error {}

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

vi.mock("@/lib/campaigns/heritage-pin-entitlement", () => ({
  findHeritagePinEntitlementForIdentity: (...args: unknown[]) => mockFindHeritagePinEntitlement(...args),
}))

vi.mock("@/lib/checkout/prepared-native-purchase-create", () => ({
  NativePreparedPurchaseError: MockNativePreparedPurchaseError,
  createOrReuseNativePreparedPurchase: (...args: unknown[]) => mockCreateOrReuseNativePreparedPurchase(...args),
}))

vi.mock("@/lib/stripe/prepared-native-purchase", () => ({
  PreparedNativePurchaseError: MockPreparedNativePurchaseError,
  issuePreparedNativePurchase: (...args: unknown[]) => mockIssuePreparedNativePurchase(...args),
}))

vi.mock("@/lib/checkout/prepared-context", () => ({
  createPreparedCheckoutContext: (...args: unknown[]) => mockCreatePreparedCheckoutContext(...args),
  isPreparedCheckoutContextEnabled: (...args: unknown[]) => mockIsPreparedCheckoutContextEnabled(...args),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: (...args: unknown[]) => mockResolveTerminalKioskSession(...args),
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
    mockFindHeritagePinEntitlement.mockReset()
    mockFindHeritagePinEntitlement.mockResolvedValue(null)
    mockCreateOrReuseNativePreparedPurchase.mockReset()
    mockIssuePreparedNativePurchase.mockReset()
    mockCreatePreparedCheckoutContext.mockReset()
    mockIsPreparedCheckoutContextEnabled.mockReset()
    mockResolveTerminalKioskSession.mockReset()
    mockCreateOrReuseNativePreparedPurchase.mockResolvedValue({ id: "purchase_1" })
    mockIssuePreparedNativePurchase.mockResolvedValue("prepared-reference")
    mockIsPreparedCheckoutContextEnabled.mockReturnValue(true)
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: { id: "server_kiosk_session_1", user: { id: "db_kiosk_user_1" } },
    })

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
    vi.useRealTimers()
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

  it("does not grant promotion authority to a direct intent request that claims public booking", async () => {
    mockValidate.mockReturnValueOnce({
      courseSlug: "bachata-beginners", courseTitle: "Bachata Beginners", amountInt: 2000, currency: "usd",
      date: "2026-10-08", time: "21:10", packageId: "", serviceId: "dropin", addons: [], safeParticipants: 1,
      coupon: "", pkg: null, packageTotalCredits: null, packageIsUnlimited: false, packageCadence: "",
      packageMakeUps: 0, packageValidDays: 180, consecutivePriceCents: null, consecutiveAddOnOnly: false,
      course: {
        enrollment: { services: [{ id: "dropin", price: 20 }] },
        scheduleRules: { promotions: [{
          id: "heritage-october", label: "Heritage pin benefit", active: true,
          pricing: { kind: "fixed", amountCents: 1500 },
          window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
          audience: "heritage_pin_delivered", channels: ["public_booking"],
        }] },
      },
    })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce({ status: "delivered" })

    const { POST } = await import("@/app/api/checkout/intent/route")
    const response = await POST(createRouteRequest({ bookingSource: "public_booking" }))

    expect(response.status).toBe(200)
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 2000,
      metadata: expect.not.objectContaining({ coursePromotionId: expect.any(String) }),
    }))
    expect(mockFindHeritagePinEntitlement).not.toHaveBeenCalled()
  })

  it("applies an eligible trusted-kiosk promotion using terminal-authorized date/time", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-03T16:00:00.000Z"))
    mockValidate.mockReturnValue({
      courseSlug: "bachata-beginners", courseTitle: "Bachata Beginners", amountInt: 2000, currency: "usd",
      date: "2026-11-05", time: "18:00", packageId: "", serviceId: "dropin", addons: [], safeParticipants: 1,
      coupon: "", pkg: null, packageTotalCredits: null, packageIsUnlimited: false, packageCadence: "",
      packageMakeUps: 0, packageValidDays: 180, consecutivePriceCents: null, consecutiveAddOnOnly: false,
      kioskCurrentCourseDate: "2026-10-08", kioskCurrentCourseTime: "21:10",
      course: {
        schedule: { availableWeekdays: [3], availableTimes: ["21:10"] },
        enrollment: { services: [{ id: "dropin", price: 20 }] },
        scheduleRules: { promotions: [{
          id: "heritage-october", label: "Heritage pin benefit", active: true,
          pricing: { kind: "fixed", amountCents: 1500 },
          window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
          audience: "heritage_pin_delivered", channels: ["trusted_kiosk"],
        }] },
      },
    })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce({ status: "delivered" })

    const { POST } = await import("@/app/api/checkout/intent/route")
    const response = await POST(createRouteRequest({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(response.status).toBe(200)
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1500,
      metadata: expect.objectContaining({
        coursePromotionId: "heritage-october",
        coursePromotionPriceCents: "1500",
        date: "2026-10-08",
        time: "21:10",
      }),
    }))
  })

  it("uses authoritative kiosk current-course date/time in payment intent metadata", async () => {
    mockValidate.mockReturnValue({
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

  it("refreshes a missing kiosk context before returning prepare-only, then the next native prepare uses prepared source", async () => {
    mockValidate.mockReturnValueOnce({
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
      kioskCurrentCourseDuration: 60,
    })
    mockResolveCheckoutPreparation
      .mockResolvedValueOnce({
        source: "fallback",
        fallbackReason: "missing_prepared_context",
        preparedContextId: undefined,
        terminalAuth: {
          ok: true,
          sessionId: "terminal_session_1",
          terminal: { id: "terminal_1", slug: "terminal-1", name: "Terminal 1", location: null, defaultCourseSlug: null, active: true },
        },
        verification: { hasVerifiedPhone: true },
        preparedAccount: {
          userId: null, clerkUser: null, resolvedUserId: "student_clerk_1",
          identity: { resolvedEmail: "student@example.com", phoneRaw: "+1 2125550100", phoneNormalized: "2125550100" },
          account: { clerkUserId: "student_clerk_1", created: false, requiresSignIn: false, hasAvatar: true },
        },
      })
      .mockResolvedValueOnce({
        source: "prepared",
        preparedContextId: "prepared_ctx_refreshed",
        terminalAuth: {
          ok: true,
          sessionId: "terminal_session_1",
          terminal: { id: "terminal_1", slug: "terminal-1", name: "Terminal 1", location: null, defaultCourseSlug: null, active: true },
        },
        verification: { hasVerifiedPhone: true },
        preparedAccount: {
          userId: "db_kiosk_user_1", clerkUser: null, resolvedUserId: "student_clerk_1",
          identity: { resolvedEmail: "student@example.com", phoneRaw: "+1 2125550100", phoneNormalized: "2125550100" },
          account: { clerkUserId: "student_clerk_1", created: false, requiresSignIn: false, hasAvatar: true },
        },
      })

    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const { POST } = await import("@/app/api/checkout/intent/route")
    const refresh = await POST(createRouteRequest({
      prepareOnly: true,
      refreshKioskPreparedContext: true,
      photoContext: "kiosk_terminal",
      kioskSessionToken: "untrusted-kiosk-token",
      kioskCurrentCourseDate: "2026-02-10",
      kioskCurrentCourseTime: "11:00",
      kioskCurrentCourseDuration: 60,
    }))

    expect(refresh.status).toBe(200)
    await expect(refresh.json()).resolves.toMatchObject({
      ok: true,
      prepareOnly: true,
      source: "prepared",
      preparedContextRefreshed: true,
    })
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("untrusted-kiosk-token", {
      terminalAuth: expect.objectContaining({ terminal: expect.objectContaining({ id: "terminal_1" }) }),
      touch: false,
    })
    expect(mockCreatePreparedCheckoutContext).toHaveBeenCalledWith(expect.objectContaining({
      terminalId: "terminal_1",
      kioskSessionId: "server_kiosk_session_1",
      preparedAccount: expect.objectContaining({ userId: "db_kiosk_user_1" }),
      validation: expect.objectContaining({ date: "2026-02-10", time: "11:00", durationMinutes: 60 }),
    }))
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-intent",
      expect.objectContaining({ segment: "prepare_only", source: "prepared", fallbackReason: null })
    )
    consoleInfo.mockRestore()
    expect(mockEnforceNewStudent).not.toHaveBeenCalled()
    expect(mockCreateOrReuseNativePreparedPurchase).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()

    const native = await POST(createRouteRequest({ paymentSurface: "native_m2_prepare", photoContext: "kiosk_terminal" }))
    expect(native.status).toBe(200)
    expect(mockCreateOrReuseNativePreparedPurchase).toHaveBeenCalledWith(expect.objectContaining({
      recipient: expect.objectContaining({ userId: "db_kiosk_user_1", email: "student@example.com" }),
      fulfillmentMetadata: expect.objectContaining({ userId: "student_clerk_1" }),
    }))
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("keeps ordinary prepare-only requests unchanged when refresh intent is absent", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ prepareOnly: true, photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, prepareOnly: true })
    expect(mockCreatePreparedCheckoutContext).not.toHaveBeenCalled()
  })

  it.each([
    ["non-kiosk", { prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "qr_phone", kioskSessionToken: "kiosk_session_1" }, true, 400],
    ["wrong photo context", { prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "external_web", kioskSessionToken: "kiosk_session_1" }, true, 400],
    ["ordinary payment", { refreshKioskPreparedContext: true, photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }, true, 400],
    ["missing kiosk session", { prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "kiosk_terminal" }, true, 400],
    ["blank kiosk session", { prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "kiosk_terminal", kioskSessionToken: "  " }, true, 400],
    ["disabled feature", { prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }, false, 409],
  ])("rejects refresh intent without writing for %s", async (_case, body, enabled, status) => {
    mockIsPreparedCheckoutContextEnabled.mockReturnValue(enabled)
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest(body))

    expect(res.status).toBe(status)
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockCreatePreparedCheckoutContext).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("rejects refresh intent without writing when terminal authorization fails", async () => {
    mockResolveCheckoutPreparation.mockResolvedValueOnce({ status: 401, error: "Terminal session required for kiosk checkout." })
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({
      prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1",
    }))

    expect(res.status).toBe(401)
    expect(mockCreatePreparedCheckoutContext).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("rejects refresh intent when preparation lacks terminal authorization", async () => {
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      terminalAuth: null,
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123", clerkUser: null, resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({
      prepareOnly: true, refreshKioskPreparedContext: true, photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1",
    }))

    expect(res.status).toBe(401)
    expect(mockCreatePreparedCheckoutContext).not.toHaveBeenCalled()
  })

  it.each(["true", 1, {}, []])("rejects non-boolean prepared-context refresh intent %j", async (refreshKioskPreparedContext) => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ refreshKioskPreparedContext }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid prepared context refresh intent" })
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockCreatePreparedCheckoutContext).not.toHaveBeenCalled()
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

  it("keeps an explicitly embedded prepared kiosk intent local when the terminal gateway is enabled", async () => {
    enableTerminalPaymentGateway()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(
      createRouteRequest({
        photoContext: "kiosk_terminal",
        kioskSessionToken: "kiosk_session_1",
        paymentSurface: "embedded",
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ clientSecret: "pi_secret_123" })
    expect(mockCreatePaymentIntent).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects native preparation requests that also request ordinary prepareOnly", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ paymentSurface: "native_m2_prepare", prepareOnly: true }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Native preparation cannot be prepare-only" })
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockCreateOrReuseNativePreparedPurchase).not.toHaveBeenCalled()
    expect(mockIssuePreparedNativePurchase).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("prepares only the validated prepared kiosk purchase and exposes no checkout internals", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({
      paymentSurface: "native_m2_prepare",
      photoContext: "kiosk_terminal",
      kioskSessionToken: "kiosk_session_1",
      courseSlug: "client-claim",
      amount: 1,
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ preparedPurchaseReference: "prepared-reference", state: "prepared" })
    expect(mockCreateOrReuseNativePreparedPurchase).toHaveBeenCalledWith(expect.objectContaining({
      preparedContextId: "prepared_ctx_1",
      recipient: expect.objectContaining({ userId: "user_123" }),
      selection: expect.objectContaining({
        courseSlug: "salsa-femenina-matutina", amount: 2000, currency: "usd", serviceId: "dropin",
      }),
      fulfillmentMetadata: expect.objectContaining({ courseSlug: "salsa-femenina-matutina", userId: "user_123" }),
    }))
    expect(mockIssuePreparedNativePurchase).toHaveBeenCalledWith({
      purchaseId: "purchase_1", terminalId: "terminal_1", sessionId: "terminal_session_1",
    })
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
    expect(mockClearPreparedCheckout).not.toHaveBeenCalled()
  })

  it("prepares the native purchase with the trusted-kiosk promotion effective amount", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-03T16:00:00.000Z"))
    mockValidate.mockReturnValue({
      courseSlug: "bachata-beginners", courseTitle: "Bachata Beginners", amountInt: 2000, currency: "usd",
      date: "2026-11-05", time: "18:00", packageId: "", serviceId: "dropin", addons: [], safeParticipants: 1,
      coupon: "", pkg: null, packageTotalCredits: null, packageIsUnlimited: false, packageCadence: "",
      packageMakeUps: 0, packageValidDays: 180, consecutivePriceCents: null, consecutiveAddOnOnly: false,
      kioskCurrentCourseDate: "2026-10-08", kioskCurrentCourseTime: "21:10",
      course: {
        schedule: { availableWeekdays: [3], availableTimes: ["21:10"] },
        enrollment: { services: [{ id: "dropin", price: 20 }] },
        scheduleRules: { promotions: [{
          id: "heritage-october", label: "Heritage pin benefit", active: true,
          pricing: { kind: "fixed", amountCents: 1500 },
          window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
          audience: "heritage_pin_delivered", channels: ["trusted_kiosk"],
        }] },
      },
    })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce({ status: "delivered" })

    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({
      paymentSurface: "native_m2_prepare",
      photoContext: "kiosk_terminal",
      kioskSessionToken: "kiosk_session_1",
    }))

    expect(res.status).toBe(200)
    expect(mockCreateOrReuseNativePreparedPurchase).toHaveBeenCalledWith(expect.objectContaining({
      selection: expect.objectContaining({ courseSlug: "bachata-beginners", amount: 1500, currency: "usd" }),
      fulfillmentMetadata: expect.objectContaining({
        coursePromotionId: "heritage-october",
        coursePromotionPriceCents: "1500",
      }),
    }))
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it.each([
    ["fallback context", { source: "fallback", preparedContextId: undefined, terminalAuth: null, userId: "user_123" }],
    ["missing existing database user", { source: "prepared", preparedContextId: "prepared_ctx_1", terminalAuth: undefined, userId: null }],
  ])("fails closed before capability or provider creation for %s", async (_case, override) => {
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: override.source,
      preparedContextId: override.preparedContextId,
      terminalAuth: override.terminalAuth,
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: override.userId,
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ paymentSurface: "native_m2_prepare", photoContext: "kiosk_terminal" }))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "Native preparation unavailable" })
    expect(mockCreateOrReuseNativePreparedPurchase).not.toHaveBeenCalled()
    expect(mockIssuePreparedNativePurchase).not.toHaveBeenCalled()
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
  })

  it("rejects unknown payment surfaces", async () => {
    const { POST } = await import("@/app/api/checkout/intent/route")
    const res = await POST(createRouteRequest({ paymentSurface: "gateway" }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid payment surface" })
    expect(mockValidate).not.toHaveBeenCalled()
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

  it.each([
    ["precondition_failure", () => mockResolveCheckoutPreparation.mockResolvedValueOnce({ source: "fallback", terminalAuth: null, verification: { hasVerifiedPhone: true }, preparedAccount: { userId: "user_123", clerkUser: null, resolvedUserId: "user_123", identity: { resolvedEmail: "test@example.com", phoneNormalized: "9293876584" }, account: {} } })],
    ["purchase_mismatch", () => mockCreateOrReuseNativePreparedPurchase.mockRejectedValueOnce(new MockNativePreparedPurchaseError("secret purchase"))],
    ["purchase_persistence_failure", () => mockCreateOrReuseNativePreparedPurchase.mockRejectedValueOnce(new Error("secret purchase"))],
    ["prepared_reference_unavailable", () => mockIssuePreparedNativePurchase.mockRejectedValueOnce(new MockPreparedNativePurchaseError("secret reference"))],
    ["prepared_reference_persistence_failure", () => mockIssuePreparedNativePurchase.mockRejectedValueOnce(new Error("secret reference"))],
  ])("keeps native preparation responses generic while logging only allowlisted %s", async (reasonCode, arrange) => {
    arrange()
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    const { POST } = await import("@/app/api/checkout/intent/route")
    const response = await POST(createRouteRequest({ paymentSurface: "native_m2_prepare", photoContext: "kiosk_terminal" }))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "Native preparation unavailable" })
    const event = log.mock.calls.find(([eventName]) => eventName === "[native-m2-prepare]")
    expect(event).toEqual(["[native-m2-prepare]", { outcome: "rejected", reasonCode }])
    expect(JSON.stringify(event)).not.toMatch(/secret|purchase_1|prepared-reference|terminal_session_1/i)
    log.mockRestore()
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
