import { beforeEach, describe, expect, it, vi } from "vitest"

const mockValidate = vi.fn()
const mockPrepareCheckoutAccount = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  purchase: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/checkout", () => ({
  prepareCheckoutAccount: (...args: unknown[]) => mockPrepareCheckoutAccount(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  enrollStudentPinForCheckout: (...args: unknown[]) => mockEnrollStudentPin(...args),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("checkout cash route", () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockPrepareCheckoutAccount.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
    mockUpsertUser.mockReset()
    mockPrisma.purchase.create.mockReset()

    mockValidate.mockResolvedValue({
      courseSlug: "salsa-feminine-morning",
      courseTitle: "Salsa feminine style (morning)",
      amountInt: 2000,
      currency: "usd",
      date: "2026-02-10",
      time: "11:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      pkg: null,
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
    mockUpsertUser.mockResolvedValue({ id: "db_user_1" })
    mockPrisma.purchase.create.mockResolvedValue({
      id: "purchase_1",
      status: "pending",
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    })
  })

  it("creates a cash purchase for valid request", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      purchaseId: "purchase_1",
      paymentMethod: "onsite",
      paymentStatus: "pending",
      account: {
        clerkUserId: "user_123",
        hasAvatar: false,
      },
    })
    expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.purchase.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: "pending",
        metadata: {
          settlementStatus: "pending",
          settledAt: null,
        },
      },
    })
  })

  it("passes kiosk photo context to account preparation", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrepareCheckoutAccount).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Object),
      expect.objectContaining({
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
      })
    )
  })

  it("returns ACCOUNT_EXISTS when account preparation is blocked", async () => {
    mockPrepareCheckoutAccount.mockResolvedValue({
      status: 409,
      error: "Account already exists. Please sign in to continue.",
      code: "ACCOUNT_EXISTS",
    })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe("ACCOUNT_EXISTS")
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })
})
