import { beforeEach, describe, expect, it, vi } from "vitest"

const mockValidate = vi.fn()
const mockPrepareCheckoutAccount = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockCreatePaymentIntent = vi.fn()

vi.mock("@/lib/checkout", () => ({
  prepareCheckoutAccount: (...args: unknown[]) => mockPrepareCheckoutAccount(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  enrollStudentPinForCheckout: (...args: unknown[]) => mockEnrollStudentPin(...args),
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
    mockPrepareCheckoutAccount.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
    mockCreatePaymentIntent.mockReset()

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
    mockPrepareCheckoutAccount.mockResolvedValue({
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
    expect(mockPrepareCheckoutAccount).toHaveBeenCalledWith(
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
})
