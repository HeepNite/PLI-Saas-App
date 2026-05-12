import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockPaymentIntentRetrieve = vi.fn()
const mockPurchaseUpsert = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockSyncPackagePurchaseFromPaidPurchase = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchase: {
      upsert: (...args: unknown[]) => mockPurchaseUpsert(...args),
    },
  },
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchaseFromPaidPurchase(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "checkout:finalize:test"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    paymentIntents = {
      retrieve: (...args: unknown[]) => mockPaymentIntentRetrieve(...args),
    }
    constructor() {}
  },
}))

describe("checkout finalize route", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.STRIPE_SECRET_KEY = "sk_test"

    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockPaymentIntentRetrieve.mockReset()
    mockPurchaseUpsert.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockSyncPackagePurchaseFromPaidPurchase.mockReset()

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          firstName: "Test",
          lastName: "User",
          primaryEmailAddress: { emailAddress: "test@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 9293876584" },
        }),
      },
    })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockPurchaseUpsert.mockResolvedValue({ id: "purchase_123", createdAt: new Date("2026-04-01T10:00:00.000Z") })
    mockSyncPackagePurchaseFromPaidPurchase.mockResolvedValue({ id: "package_purchase_1" })
  })

  it("persists succeeded payment intents as paid", async () => {
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_123",
      object: "payment_intent",
      status: "succeeded",
      amount: 2500,
      currency: "usd",
      customer: "cus_123",
      receipt_email: "buyer@example.com",
      metadata: {
        userId: "clerk_user_1",
        courseSlug: "salsa",
        courseTitle: "Salsa",
        packageId: "pkg_123",
        packageLabel: "Starter",
        packageTotalCredits: "10",
        packageIsUnlimited: "false",
        packageCadence: "weekly",
        packageMakeUps: "0",
        packageValidDays: "180",
        participants: "1",
        email: "buyer@example.com",
        phone: "9293876584",
      },
    })

    const { POST } = await import("@/app/api/checkout/finalize/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/finalize", {
        method: "POST",
        body: JSON.stringify({ paymentIntentId: "pi_123" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
    expect(mockPurchaseUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { stripePaymentIntentId: "pi_123" },
      create: {
        stripePaymentIntentId: "pi_123",
        status: "paid",
      },
      update: {
        status: "paid",
      },
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
  })

  it("does not persist incomplete payment intents as paid", async () => {
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_processing",
      object: "payment_intent",
      status: "processing",
      metadata: {},
    })

    const { POST } = await import("@/app/api/checkout/finalize/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/finalize", {
        method: "POST",
        body: JSON.stringify({ paymentIntentId: "pi_processing" }),
      })
    )

    expect(res.status).toBe(409)
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
  })

  it("uses Clerk name for canonical user and keeps payment name snapshot on purchase", async () => {
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_name_snapshot",
      object: "payment_intent",
      status: "succeeded",
      amount: 2500,
      currency: "usd",
      customer: "cus_123",
      receipt_email: "buyer@example.com",
      metadata: {
        userId: "clerk_user_1",
        name: "Mariano Barrionuevo",
        email: "buyer@example.com",
        phone: "9293876584",
        participants: "1",
      },
    })

    const { POST } = await import("@/app/api/checkout/finalize/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/finalize", {
        method: "POST",
        body: JSON.stringify({ paymentIntentId: "pi_name_snapshot" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: "clerk_user_1",
        name: "Test User",
      })
    )
    expect(mockPurchaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: "Mariano Barrionuevo" }),
        update: expect.objectContaining({ name: "Mariano Barrionuevo" }),
      })
    )
  })
})
