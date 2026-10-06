import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockValidate = vi.fn()
const mockFindHeritagePinEntitlement = vi.fn()
const mockCreatePaymentIntent = vi.fn()
const mockCreateCheckoutSession = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockClerkClient = vi.fn()
const mockPrismaWrites = {
  purchaseCreate: vi.fn(),
  reservationCreate: vi.fn(),
  packagePurchaseUpdate: vi.fn(),
  userCreate: vi.fn(),
}

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

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))
vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))
vi.mock("@/lib/campaigns/heritage-pin-entitlement", () => ({
  findHeritagePinEntitlementForIdentity: (...args: unknown[]) => mockFindHeritagePinEntitlement(...args),
}))
vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchase: { create: (...args: unknown[]) => mockPrismaWrites.purchaseCreate(...args) },
    reservation: { create: (...args: unknown[]) => mockPrismaWrites.reservationCreate(...args) },
    packagePurchase: { update: (...args: unknown[]) => mockPrismaWrites.packagePurchaseUpdate(...args) },
    user: { create: (...args: unknown[]) => mockPrismaWrites.userCreate(...args) },
  },
}))
vi.mock("stripe", () => ({
  default: class Stripe {
    paymentIntents = { create: (...args: unknown[]) => mockCreatePaymentIntent(...args) }
    checkout = { sessions: { create: (...args: unknown[]) => mockCreateCheckoutSession(...args) } }
  },
}))

const everyonePromotionValidation = () => promotionValidation({
  course: {
    schedule: { availableWeekdays: [3], availableTimes: ["21:10"] },
    enrollment: { services: [{ id: "dropin", price: 20 }] },
    scheduleRules: { promotions: [{
      id: "october-public", label: "October public price", active: true,
      pricing: { kind: "fixed", amountCents: 1800 },
      window: { basis: "class_date", startDate: "2026-10-01", endDate: "2026-10-31" },
      audience: "everyone", channels: ["public_booking"],
    }] },
  },
})

const request = (body: Record<string, unknown> = {}) => new Request("http://localhost/api/public/checkout/quote", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

describe("public checkout quote route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-03T16:00:00.000Z"))
    mockAuth.mockReset()
    mockValidate.mockReset()
    mockFindHeritagePinEntitlement.mockReset()
    mockCreatePaymentIntent.mockReset()
    mockCreateCheckoutSession.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockClerkClient.mockReset()
    Object.values(mockPrismaWrites).forEach((mock) => mock.mockReset())
    mockAuth.mockResolvedValue({ userId: "clerk_eligible" })
    mockValidate.mockResolvedValue(promotionValidation())
    mockFindHeritagePinEntitlement.mockResolvedValue({ status: "delivered" })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the canonical Heritage price and public label for an eligible authenticated user", async () => {
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request({ amount: 1, email: "submitted@example.com", phone: "5551234567" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      amountCents: 1500,
      currency: "usd",
      promotionLabel: "Heritage pin benefit",
    })
    expect(mockValidate).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }))
    expect(mockFindHeritagePinEntitlement).toHaveBeenCalledWith(expect.anything(), { clerkId: "clerk_eligible" })
  })

  it.each([
    ["no entitlement", () => mockFindHeritagePinEntitlement.mockResolvedValueOnce(null)],
    ["out-of-window class", () => mockValidate.mockResolvedValueOnce(promotionValidation({ date: "2026-11-05" }))],
    ["package booking", () => mockValidate.mockResolvedValueOnce(promotionValidation({ packageId: "ten-class" }))],
  ])("returns the canonical non-promotional amount without a reason for %s", async (_, arrange) => {
    arrange()
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ amountCents: 2000, currency: "usd" })
  })

  it("returns an everyone promotion for an anonymous caller without entitlement", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce(null)
    mockValidate.mockResolvedValueOnce(everyonePromotionValidation())
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      amountCents: 1800,
      currency: "usd",
      promotionLabel: "October public price",
    })
    expect(mockFindHeritagePinEntitlement).toHaveBeenCalledWith(expect.anything(), {})
  })

  it("returns the canonical regular quote with no reason for an anonymous Heritage caller", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ amountCents: 2000, currency: "usd" })
    expect(mockFindHeritagePinEntitlement).toHaveBeenCalledWith(expect.anything(), {})
  })

  it("does not let submitted contact details substitute for an authenticated identity", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request({ email: "eligible@example.com", phone: "5551234567" }))

    expect(await response.json()).toEqual({ amountCents: 2000, currency: "usd" })
    expect(mockFindHeritagePinEntitlement).toHaveBeenCalledWith(expect.anything(), {})
  })

  it("does not call payment, account, purchase, reservation, or package write collaborators", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockValidate.mockResolvedValueOnce(everyonePromotionValidation())
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockClerkClient).not.toHaveBeenCalled()
    Object.values(mockPrismaWrites).forEach((mock) => expect(mock).not.toHaveBeenCalled())
  })

  it.each([
    ["forged currency", { currency: "eur" }],
    ["impossible date", { date: "2026-02-30" }],
    ["unscheduled occurrence", { date: "2026-10-09" }],
  ])("rejects %s without creating checkout state", async (_, overrides) => {
    mockValidate.mockResolvedValueOnce(promotionValidation(overrides))
    const { POST } = await import("@/app/api/public/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid public booking request", code: "PUBLIC_BOOKING_POLICY_INVALID" })
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled()
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockClerkClient).not.toHaveBeenCalled()
    Object.values(mockPrismaWrites).forEach((mock) => expect(mock).not.toHaveBeenCalled())
  })
})
