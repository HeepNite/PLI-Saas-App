import { beforeEach, describe, expect, it, vi } from "vitest"

const mockHeaders = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockSyncPackagePurchaseFromPaidPurchase = vi.fn()
const mockSyncScheduledAttendanceFromPurchase = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockPurchaseUpsert = vi.fn()
const mockPurchaseFindUnique = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCreate = vi.fn()
const mockPurchaseUpdate = vi.fn()
const mockConstructEvent = vi.fn()

const mockPrisma = {
  purchase: {
    upsert: (...args: unknown[]) => mockPurchaseUpsert(...args),
    findUnique: (...args: unknown[]) => mockPurchaseFindUnique(...args),
    findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    create: (...args: unknown[]) => mockPurchaseCreate(...args),
    update: (...args: unknown[]) => mockPurchaseUpdate(...args),
  },
  $transaction: vi.fn(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma as any)),
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
    mockPurchaseFindUnique.mockReset()
    mockPurchaseFindFirst.mockReset()
    mockPurchaseCreate.mockReset()
    mockPurchaseUpdate.mockReset()
    mockConstructEvent.mockReset()
    mockPrisma.$transaction.mockClear()

    mockHeaders.mockResolvedValue({
      get: (name: string) => (name === "stripe-signature" ? "sig_test" : null),
    })
    mockClerkClient.mockResolvedValue({ users: { getUser: vi.fn() } })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockPurchaseUpsert.mockResolvedValue({
      id: "purchase_123",
      createdAt: new Date("2026-03-24T12:00:00.000Z"),
    })
    mockPurchaseFindUnique.mockResolvedValue(null)
    mockPurchaseFindFirst.mockResolvedValue(null)
    mockPurchaseCreate.mockResolvedValue({ id: "purchase_child_1" })
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
            flowContext: "kiosk_terminal",
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
    const upsertPayload = mockPurchaseUpsert.mock.calls[0]?.[0]
    expect(upsertPayload?.create?.status).toBe("paid")
    expect(upsertPayload?.create?.status).not.toBe("pending")
    expect(upsertPayload?.update?.status).toBe("paid")
    expect(upsertPayload?.update?.status).not.toBe("pending")
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredStatus: "checked_in",
        source: "stripe_webhook_checkout",
      })
    )
  })

  it("splits hosted checkout consecutive metadata and schedules both course attendances", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_consecutive",
          payment_status: "paid",
          amount_total: 3500,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_123",
          customer_details: {
            email: "test@example.com",
            name: "Test User",
            phone: "+1 9293876584",
          },
          metadata: {
            courseSlug: "salsa-feminine-morning",
            courseTitle: "Salsa Feminine Morning",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
            consecutivePriceCents: "1500",
            consecutiveLinkedCourseSlug: "bachata-basics",
            consecutiveCourseTitle: "Bachata Basics",
            consecutiveLinkedCourseTime: "12:00",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_consecutive_1" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
    expect(mockPurchaseUpsert.mock.calls[0]?.[0]).toMatchObject({
      update: { amount: 2000 },
      create: { amount: 2000 },
    })
    expect(mockPurchaseCreate).toHaveBeenCalledTimes(1)
    expect(mockPurchaseCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        amount: 1500,
        courseSlug: "bachata-basics",
        courseTitle: "Bachata Basics",
        metadata: expect.objectContaining({
          parentPurchaseId: "purchase_123",
          courseSlug: "bachata-basics",
          courseTitle: "Bachata Basics",
          time: "12:00",
        }),
      },
    })
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(2)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        purchaseId: "purchase_123",
        courseSlug: "salsa-feminine-morning",
        time: "11:00",
        preferredStatus: "scheduled",
      })
    )
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        purchaseId: "purchase_child_1",
        courseSlug: "bachata-basics",
        time: "12:00",
        preferredStatus: "scheduled",
      })
    )
  })

  it("uses stored flowContext fallback when event metadata omits it", async () => {
    mockPurchaseFindUnique.mockResolvedValue({
      metadata: { flowContext: "kiosk_terminal" },
    })
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_no_flow",
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
            serviceId: "dropin",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_no_flow" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ preferredStatus: "checked_in" })
    )
  })

  it("does not trust Stripe cardholder name for canonical user upsert", async () => {
    const getUser = vi.fn().mockResolvedValue({
      firstName: "Danna",
      lastName: "Jhon",
      username: null,
      primaryEmailAddress: { emailAddress: "danna@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 9293876584" },
    })
    mockClerkClient.mockResolvedValue({ users: { getUser } })

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_name_snapshot",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_123",
          customer_details: {
            email: "danna@example.com",
            name: "Mariano Barrionuevo",
            phone: "+1 9293876584",
          },
          metadata: {
            userId: "clerk_user_1",
            email: "danna@example.com",
            phone: "9293876584",
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_name_snapshot" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: "clerk_user_1",
        email: "danna@example.com",
        name: "Danna Jhon",
      })
    )

    expect(mockPurchaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: "Mariano Barrionuevo" }),
        update: expect.objectContaining({ name: "Mariano Barrionuevo" }),
      })
    )
  })

  it("is idempotent for consecutive child creation when webhook replays", async () => {
    mockPurchaseFindFirst.mockResolvedValue({ id: "purchase_child_existing" })
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_replay",
          payment_status: "paid",
          amount_total: 3500,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_123",
          customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
          metadata: {
            courseSlug: "salsa-feminine-morning",
            date: "2026-02-10",
            time: "11:00",
            consecutivePriceCents: "1500",
            consecutiveLinkedCourseSlug: "bachata-basics",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_consecutive_replay" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseCreate).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(2)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ purchaseId: "purchase_child_existing", courseSlug: "bachata-basics" })
    )
  })

  it("normalizes payment intent success to paid before persisting", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_456",
          status: "succeeded",
          amount: 3000,
          currency: "usd",
          customer: "cus_456",
          receipt_email: "intent@example.com",
          metadata: {
            courseSlug: "bachata",
            courseTitle: "Bachata",
            packageId: "pkg_456",
            packageLabel: "Package",
            packageTotalCredits: "8",
            packageIsUnlimited: "false",
            packageCadence: "weekly",
            packageMakeUps: "0",
            packageValidDays: "90",
            userId: "guest",
            participants: "1",
            email: "intent@example.com",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_456" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
    expect(mockPurchaseUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { stripePaymentIntentId: "pi_456" },
      create: {
        stripePaymentIntentId: "pi_456",
        status: "paid",
      },
      update: {
        status: "paid",
      },
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
  })
})
