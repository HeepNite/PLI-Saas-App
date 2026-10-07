import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockValidate = vi.fn()
const mockEnforceBookingPolicy = vi.fn()
const mockResolvePricing = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }))
vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))
vi.mock("@/lib/checkout/public-booking-policy", () => ({
  enforcePublicBookingPolicy: (...args: unknown[]) => mockEnforceBookingPolicy(...args),
}))
vi.mock("@/lib/checkout/course-promotion-pricing", () => ({
  resolveCoursePromotionCheckoutPricing: (...args: unknown[]) => mockResolvePricing(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

const validation = (overrides: Record<string, unknown> = {}) => ({
  courseSlug: "bachata-beginners",
  courseTitle: "Bachata Beginners",
  amountInt: 2000,
  currency: "USD",
  date: "2026-10-08",
  time: "21:10",
  packageId: "",
  serviceId: "dropin",
  addons: [],
  safeParticipants: 1,
  coupon: "",
  consecutivePriceCents: null,
  consecutiveAddOnOnly: false,
  course: {
    enrollment: { services: [{ id: "dropin", price: 20 }] },
    scheduleRules: { promotions: [{ id: "profile-october", label: "Profile October price" }] },
  },
  ...overrides,
})

const request = (body: Record<string, unknown> = {}) => new Request("http://localhost/api/profile/checkout/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe("profile checkout quote route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockValidate.mockReset()
    mockEnforceBookingPolicy.mockReset()
    mockResolvePricing.mockReset()
    mockAuth.mockResolvedValue({ userId: "clerk_eligible" })
    mockValidate.mockResolvedValue(validation())
    mockEnforceBookingPolicy.mockReturnValue({ currency: "usd" })
    mockResolvePricing.mockResolvedValue({
      effectiveAmountCents: 1500,
      appliedPromotion: { promotion: { label: "Profile October price" } },
    })
  })

  it("requires an authenticated Clerk user before validating the request", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolvePricing).not.toHaveBeenCalled()
  })

  it("returns only canonical pricing resolved for the profile identity", async () => {
    const { POST } = await import("@/app/api/profile/checkout/quote/route")
    const response = await POST(request({ amount: 1, email: "submitted@example.com", phone: "5551234567" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      amountCents: 1500,
      currency: "usd",
      promotionLabel: "Profile October price",
    })
    expect(mockValidate).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }))
    expect(mockEnforceBookingPolicy).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }))
    expect(mockResolvePricing).toHaveBeenCalledWith(expect.objectContaining({
      trustedChannel: "profile",
      resolvedIdentity: { clerkId: "clerk_eligible" },
      authoritativePromotions: [{ id: "profile-october", label: "Profile October price" }],
      checkoutShape: expect.objectContaining({ serviceId: "dropin", safeParticipants: 1 }),
    }))
  })

  it("returns existing validation and booking-policy failures without resolving pricing", async () => {
    mockEnforceBookingPolicy.mockReturnValueOnce({
      status: 400,
      error: "Invalid public booking request",
      code: "PUBLIC_BOOKING_POLICY_INVALID",
    })
    const { POST } = await import("@/app/api/profile/checkout/quote/route")
    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid public booking request", code: "PUBLIC_BOOKING_POLICY_INVALID" })
    expect(mockResolvePricing).not.toHaveBeenCalled()
  })
})
