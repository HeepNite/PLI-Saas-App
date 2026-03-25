import { beforeEach, describe, expect, it, vi } from "vitest"

const mockHeaders = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockSyncPackagePurchaseFromPaidPurchase = vi.fn()
const mockSyncScheduledAttendanceFromPurchase = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockPurchaseUpsert = vi.fn()
const mockConstructEvent = vi.fn()

const mockPrisma = {
  purchase: {
    upsert: (...args: unknown[]) => mockPurchaseUpsert(...args),
  },
}

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchaseFromPaidPurchase(...args),
}))

vi.mock("@/lib/bookings", () => ({
  syncScheduledAttendanceFromPurchase: (...args: unknown[]) => mockSyncScheduledAttendanceFromPurchase(...args),
}))

vi.mock("@/lib/points/service", () => ({
  awardPointsFromRule: (...args: unknown[]) => mockAwardPointsFromRule(...args),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    webhooks = {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    }
    constructor() {}
  },
}))

describe("stripe webhook checkout session persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.STRIPE_SECRET_KEY = "sk_test"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"

    mockHeaders.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockSyncPackagePurchaseFromPaidPurchase.mockReset()
    mockSyncScheduledAttendanceFromPurchase.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockPurchaseUpsert.mockReset()
    mockConstructEvent.mockReset()

    mockHeaders.mockResolvedValue({
      get: (name: string) => (name === "stripe-signature" ? "sig_test" : null),
    })
    mockClerkClient.mockResolvedValue({ users: { getUser: vi.fn() } })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockPurchaseUpsert.mockResolvedValue({
      id: "purchase_123",
      createdAt: new Date("2026-03-24T12:00:00.000Z"),
    })
    mockSyncPackagePurchaseFromPaidPurchase.mockResolvedValue({ id: "package_purchase_1", packageId: "pkg_123" })
    mockSyncScheduledAttendanceFromPurchase.mockResolvedValue(undefined)
    mockAwardPointsFromRule.mockResolvedValue(undefined)
  })

  it("persists hosted checkout success through Purchase upsert", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_123",
          customer_details: {
            email: "test@example.com",
            name: "Test User",
            phone: "+1 9293876584",
          },
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            packageId: "pkg_123",
            packageLabel: "Package",
            packageTotalCredits: "10",
            packageIsUnlimited: "false",
            packageCadence: "weekly",
            packageMakeUps: "0",
            packageValidDays: "180",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
            coupon: "",
            addons: "",
            name: "Test User",
            email: "test@example.com",
            phone: "9293876584",
            phoneRaw: "+1 9293876584",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_123" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
    expect(mockPurchaseUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { stripeCheckoutSessionId: "cs_test_123" },
      create: {
        stripeCheckoutSessionId: "cs_test_123",
        stripePaymentIntentId: "pi_123",
        status: "paid",
      },
      update: {
        stripePaymentIntentId: "pi_123",
        status: "paid",
      },
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
  })
})
