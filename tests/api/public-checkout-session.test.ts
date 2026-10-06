import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockCreateCheckoutSession = vi.fn()
const mockFindHeritagePinEntitlement = vi.fn()

const promotionValidation = (overrides: Record<string, unknown> = {}) => ({
  courseSlug: "bachata-beginners", courseTitle: "Bachata Beginners", amountInt: 2000, currency: "USD",
  date: "2026-10-08", time: "21:10", packageId: "", serviceId: "dropin", addons: [], safeParticipants: 1,
  coupon: "", pkg: null, packageTotalCredits: null, packageIsUnlimited: false, packageCadence: "",
  packageMakeUps: 0, packageValidDays: 180, consecutivePriceCents: null, consecutiveAddOnOnly: false,
  course: {
    schedule: { availableWeekdays: [3], availableTimes: ["21:10"] },
    enrollment: { services: [{ id: "dropin", price: 20 }] },
    scheduleRules: { promotions: [{
      id: "heritage-october", label: "Heritage pin benefit", active: true,
      pricing: { kind: "fixed", amountCents: 1500 },
      window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
      audience: "heritage_pin_delivered", channels: ["public_booking"],
    }] },
  },
  ...overrides,
})

vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  clearPreparedCheckoutAfterSuccess: vi.fn(),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("@/lib/campaigns/heritage-pin-entitlement", () => ({
  findHeritagePinEntitlementForIdentity: (...args: unknown[]) => mockFindHeritagePinEntitlement(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create: (...args: unknown[]) => mockCreateCheckoutSession(...args) } }
    constructor() {}
  },
}))

describe("public checkout session route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-03T16:00:00.000Z"))
    process.env.STRIPE_SECRET_KEY = "sk_test"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockCreateCheckoutSession.mockReset()
    mockFindHeritagePinEntitlement.mockReset()

    mockValidate.mockResolvedValue(promotionValidation())
    mockResolveCheckoutPreparation.mockResolvedValue({
      source: "fallback", verification: { hasVerifiedPhone: true }, terminalAuth: null,
      preparedAccount: {
        clerkUser: null, resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    mockEnforceNewStudent.mockResolvedValue(null)
    mockFindHeritagePinEntitlement.mockResolvedValue({ status: "delivered" })
    mockCreateCheckoutSession.mockResolvedValue({
      id: "cs_test_123", url: "https://stripe.test/session", expires_at: 1_775_958_000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("applies an eligible delivered-Heritage promotion through the trusted public wrapper", async () => {
    const { POST } = await import("@/app/api/public/checkout/session/route")
    const response = await POST(new Request("http://localhost/api/public/checkout/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingSource: "public_booking", heritagePinCountryCode: "MX" }),
    }))

    expect(response.status).toBe(200)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ currency: "usd", unit_amount: 1500 }) })],
      metadata: expect.objectContaining({
        coursePromotionId: "heritage-october",
        coursePromotionPriceCents: "1500",
      }),
    }))
  })

  it("uses the refreshed authoritative course promotion and price after identity preparation", async () => {
    const initial = promotionValidation()
    const refreshed = promotionValidation({
      amountInt: 2500,
      course: {
        ...initial.course,
        enrollment: { services: [{ id: "dropin", price: 25 }] },
        scheduleRules: { promotions: [{
          id: "heritage-refreshed", label: "Refreshed Heritage benefit", active: true,
          pricing: { kind: "fixed", amountCents: 1300 },
          window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
          audience: "heritage_pin_delivered", channels: ["public_booking"],
        }] },
      },
    })
    mockValidate.mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed)

    const { POST } = await import("@/app/api/public/checkout/session/route")
    const response = await POST(new Request("http://localhost/api/public/checkout/session", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
    expect(mockValidate).toHaveBeenCalledTimes(2)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 1300 }) })],
      metadata: expect.objectContaining({ coursePromotionId: "heritage-refreshed" }),
    }))
  })

  it.each([
    ["forged currency", { currency: "eur" }],
    ["impossible date", { date: "2026-02-30" }],
    ["unscheduled occurrence", { date: "2026-10-09" }],
  ])("rejects refreshed %s before creating a checkout session", async (_, overrides) => {
    mockValidate.mockResolvedValueOnce(promotionValidation()).mockResolvedValueOnce(promotionValidation(overrides))
    const { POST } = await import("@/app/api/public/checkout/session/route")
    const response = await POST(new Request("http://localhost/api/public/checkout/session", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid public booking request", code: "PUBLIC_BOOKING_POLICY_INVALID" })
    expect(mockEnforceNewStudent).not.toHaveBeenCalled()
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })
})
