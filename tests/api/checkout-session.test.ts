import { describe, it, expect, vi, beforeEach } from "vitest"

const mockValidate = vi.fn()
const mockResolveAuth = vi.fn()
const mockResolveIdentity = vi.fn()
const mockEnsureGuest = vi.fn()
const mockEnforceNewStudent = vi.fn()

vi.mock("@/lib/checkout", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
  resolveAuthUser: (...args: unknown[]) => mockResolveAuth(...args),
  resolveContactIdentity: (...args: unknown[]) => mockResolveIdentity(...args),
  ensureGuestClerkUser: (...args: unknown[]) => mockEnsureGuest(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://stripe.test/session" }),
      },
    }
    constructor() {}
  },
}))

describe("checkout session route", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    mockValidate.mockReset()
    mockResolveAuth.mockReset()
    mockResolveIdentity.mockReset()
    mockEnsureGuest.mockReset()
    mockEnforceNewStudent.mockReset()
  })

  it("returns checkout session url", async () => {
    const validation = {
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
    }
    mockValidate.mockReturnValue(validation)
    mockResolveAuth.mockResolvedValue({ userId: "user_123", clerkUser: null })
    mockResolveIdentity.mockReturnValue({
      resolvedEmail: "test@example.com",
      phoneRaw: "+1 9293876584",
      phoneNormalized: "9293876584",
    })
    mockEnsureGuest.mockResolvedValue({ ensuredClerkUser: null })
    mockEnforceNewStudent.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkout/session/route")
    const req = new Request("http://localhost/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.url).toBe("https://stripe.test/session")
  })
})
