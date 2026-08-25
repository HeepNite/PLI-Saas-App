import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
const mockStripeWebhookEventCreate = vi.fn()
const mockStripeWebhookEventUpdateMany = vi.fn()
const mockStripeWebhookEventFindUnique = vi.fn()
const mockStripeWebhookEventUpdate = vi.fn()
const mockDayOfWeekFindUnique = vi.fn()
const mockDayOfWeekUpdate = vi.fn()
const mockDayOfWeekCreate = vi.fn()

const mockPrisma = {
  purchase: {
    upsert: (...args: unknown[]) => mockPurchaseUpsert(...args),
    findUnique: (...args: unknown[]) => mockPurchaseFindUnique(...args),
    findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    create: (...args: unknown[]) => mockPurchaseCreate(...args),
    update: (...args: unknown[]) => mockPurchaseUpdate(...args),
  },
  stripeWebhookEvent: {
    create: (...args: unknown[]) => mockStripeWebhookEventCreate(...args),
    updateMany: (...args: unknown[]) => mockStripeWebhookEventUpdateMany(...args),
    findUnique: (...args: unknown[]) => mockStripeWebhookEventFindUnique(...args),
    update: (...args: unknown[]) => mockStripeWebhookEventUpdate(...args),
  },
  dayOfWeekPurchaseCount: {
    findUnique: (...args: unknown[]) => mockDayOfWeekFindUnique(...args),
    update: (...args: unknown[]) => mockDayOfWeekUpdate(...args),
    create: (...args: unknown[]) => mockDayOfWeekCreate(...args),
  },
  $transaction: vi.fn(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma)),
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
    mockStripeWebhookEventCreate.mockReset()
    mockStripeWebhookEventUpdateMany.mockReset()
    mockStripeWebhookEventFindUnique.mockReset()
    mockStripeWebhookEventUpdate.mockReset()
    mockDayOfWeekFindUnique.mockReset()
    mockDayOfWeekUpdate.mockReset()
    mockDayOfWeekCreate.mockReset()
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
    mockStripeWebhookEventCreate.mockResolvedValue({
      id: "swe_1",
      eventId: "evt_test",
      eventType: "test",
      status: "processing",
      attempts: 0,
    })
    mockStripeWebhookEventUpdateMany.mockResolvedValue({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValue(null)
    mockStripeWebhookEventUpdate.mockResolvedValue({
      id: "swe_1",
      eventId: "evt_test",
      eventType: "test",
      status: "completed",
      attempts: 0,
    })
    mockDayOfWeekFindUnique.mockResolvedValue(null)
    mockDayOfWeekUpdate.mockResolvedValue({})
    mockDayOfWeekCreate.mockResolvedValue({})
    mockSyncPackagePurchaseFromPaidPurchase.mockResolvedValue({ id: "package_purchase_1", packageId: "pkg_123" })
    mockSyncScheduledAttendanceFromPurchase.mockResolvedValue(undefined)
    mockAwardPointsFromRule.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("persists hosted checkout success through Purchase upsert", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_123",
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
    expect(upsertPayload?.create?.metadata).toMatchObject({
      paymentChannel: "card",
      settlementStatus: "paid",
      settledAt: expect.any(String),
    })
    expect(upsertPayload?.update?.metadata).toMatchObject({
      paymentChannel: "card",
      settlementStatus: "paid",
      settledAt: expect.any(String),
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredStatus: "checked_in",
        source: "stripe_webhook_checkout",
      })
    )
  })

  it("updates the pending special purchase and schedules one fixed attendance", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-30T14:00:00.000Z"))
    mockPurchaseFindUnique
      .mockResolvedValueOnce({
        amount: 2000,
        currency: "usd",
        metadata: { specialEventKey: "special-salsa-class-2026-08-30", lockedAmountCents: "2000" },
      })
      .mockResolvedValueOnce(null)
    mockConstructEvent.mockReturnValue({
      id: "evt_special_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_special_paid",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_special",
          payment_intent: "pi_special",
          customer_details: { email: "ada@example.com", name: "Ada Lovelace", phone: "+12015550123" },
          metadata: {
            specialEventKey: "special-salsa-class-2026-08-30",
            attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
            lockedAmountCents: "2000",
            courseSlug: "tampered-course",
            courseTitle: "Tampered title",
            date: "2030-01-01",
            time: "01:00",
            userId: "clerk_special_1",
            participants: "99",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCheckoutSessionId: "cs_special_paid" },
      update: expect.objectContaining({
        status: "paid",
        amount: 2000,
        currency: "usd",
        courseSlug: "special-salsa-calena-2026-08-30",
        courseTitle: "Special Salsa Caleña Class",
        participants: 1,
      }),
    }))
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledWith(expect.objectContaining({
      courseSlug: "special-salsa-calena-2026-08-30",
      date: "2026-08-30",
      time: "16:00",
      preferredStatus: "scheduled",
    }))
  })

  it("rejects a special Checkout Session whose amount differs from the locked Purchase", async () => {
    mockPurchaseFindUnique.mockResolvedValueOnce({
      amount: 2000,
      currency: "usd",
      metadata: { specialEventKey: "special-salsa-class-2026-08-30", lockedAmountCents: "2000" },
    })
    mockConstructEvent.mockReturnValue({
      id: "evt_special_mismatch",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_special_mismatch",
          payment_status: "paid",
          amount_total: 2500,
          currency: "usd",
          customer: "cus_special",
          payment_intent: "pi_special_mismatch",
          customer_details: { email: "ada@example.com", name: "Ada Lovelace", phone: "+12015550123" },
          metadata: {
            specialEventKey: "special-salsa-class-2026-08-30",
            attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
            lockedAmountCents: "2500",
            userId: "clerk_special_1",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(500)
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
  })

  it("rejects a special Checkout Session when the locked Purchase lacks its special marker", async () => {
    mockPurchaseFindUnique.mockResolvedValueOnce({
      amount: 2000,
      currency: "usd",
      metadata: { lockedAmountCents: "2000" },
    })
    mockConstructEvent.mockReturnValue({
      id: "evt_special_missing_purchase_marker",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_special_missing_purchase_marker",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          metadata: {
            specialEventKey: "special-salsa-class-2026-08-30",
            lockedAmountCents: "2000",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(500)
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
  })

  it("leaves special PaymentIntent success fulfillment to the Checkout Session event", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_special_intent_paid",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_special",
          status: "succeeded",
          amount: 2000,
          currency: "usd",
          customer: "cus_special",
          receipt_email: "ada@example.com",
          metadata: {
            specialEventKey: "special-salsa-class-2026-08-30",
            attemptId: "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
            lockedAmountCents: "2000",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(200)
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
  })

  it.each([
    ["checkout.session.expired", "expired"],
    ["checkout.session.async_payment_failed", "failed"],
  ])("marks a special hold terminal on %s without creating attendance", async (eventType, status) => {
    mockPurchaseFindUnique.mockResolvedValueOnce({
      id: "purchase_special_pending",
      status: "pending",
      metadata: { specialEventKey: "special-salsa-class-2026-08-30" },
    })
    mockPurchaseUpdate.mockResolvedValueOnce({})
    mockConstructEvent.mockReturnValue({
      id: `evt_${status}`,
      type: eventType,
      created: 1_787_517_000,
      data: {
        object: {
          id: "cs_special_terminal",
          created: 1_787_515_200,
          expires_at: 1_787_517_000,
          metadata: { specialEventKey: "special-salsa-class-2026-08-30" },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(200)
    expect(mockPurchaseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "purchase_special_pending" },
      data: expect.objectContaining({ status }),
    }))
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
  })

  it("splits hosted checkout consecutive metadata and schedules both course attendances", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_consecutive_1",
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
        // Top-level column (design §2b a) — the DB-level uniqueness guard for
        // @@unique([parentPurchaseId]). Must be set IN ADDITION to metadata below.
        parentPurchaseId: "purchase_123",
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

  it("recovers from a concurrent double-create of the consecutive child via a P2002 refetch outside the transaction", async () => {
    const { Prisma } = await import("@prisma/client")

    // Simulate the losing worker: the transaction (pre-check findFirst + create)
    // throws P2002 because a concurrent worker's create won the race on
    // @@unique([parentPurchaseId]) first. Postgres aborts the whole transaction
    // on any statement failure inside it (25P02) — the recovery read must
    // happen OUTSIDE the transaction, on the top-level `prisma` client, not `tx`
    // (design §6/ADR-4d, baked-in constraint #2).
    mockPrisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`parentPurchaseId`)", {
        code: "P2002",
        clientVersion: "test",
      })
    )
    // Calls to prisma.purchase.findUnique before the consecutive-child block
    // (existingByIntent linkage, existingPurchase metadata fetch) — both null.
    mockPurchaseFindUnique.mockResolvedValueOnce(null)
    mockPurchaseFindUnique.mockResolvedValueOnce(null)
    // The P2002-recovery refetch: top-level prisma.purchase.findUnique keyed on
    // the column, returning the concurrent winner's row.
    mockPurchaseFindUnique.mockResolvedValueOnce({ id: "purchase_child_winner" })

    mockConstructEvent.mockReturnValue({
      id: "evt_consecutive_concurrent",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_concurrent",
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
        body: JSON.stringify({ id: "evt_consecutive_concurrent" }),
      })
    )

    // Must not propagate the P2002 as an unhandled throw — the refetch resolves
    // it cleanly and the webhook still reports success.
    expect(res.status).toBe(200)

    // The recovery refetch must be keyed on the top-level column, not the
    // metadata path used by the pre-check (baked-in constraint #1 stays intact).
    expect(mockPurchaseFindUnique).toHaveBeenCalledWith({
      where: { parentPurchaseId: "purchase_123" },
    })

    // Downstream processing continues using the winner's row, not a duplicate.
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(2)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        purchaseId: "purchase_child_winner",
        courseSlug: "bachata-basics",
      })
    )
  })

  it("uses stored flowContext fallback when event metadata omits it", async () => {
    mockPurchaseFindUnique.mockResolvedValue({
      metadata: { flowContext: "kiosk_terminal" },
    })
    mockConstructEvent.mockReturnValue({
      id: "evt_no_flow",
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
      id: "evt_name_snapshot",
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
      id: "evt_consecutive_replay",
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
      id: "evt_456",
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
        metadata: expect.objectContaining({
          paymentChannel: "card",
          settlementStatus: "paid",
          settledAt: expect.any(String),
        }),
      },
      update: {
        status: "paid",
        metadata: expect.objectContaining({
          paymentChannel: "card",
          settlementStatus: "paid",
          settledAt: expect.any(String),
        }),
      },
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(1)
  })

  it("reprocesses on redelivery after a failed attempt (regression: a throw must not be permanently marked processed)", async () => {
    const { Prisma } = await import("@prisma/client")

    const buildEvent = () => ({
      id: "evt_retry_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_retry",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_retry_1",
          customer_details: {
            email: "retry@example.com",
            name: "Retry User",
            phone: "+1 9293876584",
          },
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
          },
        },
      },
    })

    // --- First delivery: claim succeeds, downstream processing throws ---
    mockConstructEvent.mockReturnValue(buildEvent())
    mockStripeWebhookEventCreate.mockResolvedValueOnce({
      id: "swe_retry_1",
      eventId: "evt_retry_1",
      eventType: "checkout.session.completed",
      status: "processing",
      attempts: 0,
    })
    mockPurchaseUpsert.mockRejectedValueOnce(new Error("downstream write failed"))

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const firstRes = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_retry_1" }),
      })
    )

    expect(firstRes.status).toBe(500)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)

    // --- Second delivery (redelivery of the same event.id): must re-run processing, not be swallowed as a duplicate ---
    mockConstructEvent.mockReturnValue(buildEvent())
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )
    // Post-fix reclaim path: the failed row is atomically re-claimed via updateMany.
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockPurchaseUpsert.mockResolvedValueOnce({
      id: "purchase_retry_1",
      createdAt: new Date("2026-03-24T12:00:00.000Z"),
    })

    const secondRes = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_retry_1" }),
      })
    )

    expect(secondRes.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(2)
  })

  it("no-ops on duplicate delivery of an already-completed event", async () => {
    const { Prisma } = await import("@prisma/client")
    mockConstructEvent.mockReturnValue({
      id: "evt_duplicate_completed",
      type: "checkout.session.completed",
      data: { object: { id: "cs_duplicate", payment_status: "paid", amount_total: 2000, currency: "usd" } },
    })
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_duplicate_completed",
      status: "completed",
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_duplicate_completed" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
  })

  it("no-ops on duplicate delivery of a legacy (pre-fix) event without auto-reclaiming it", async () => {
    const { Prisma } = await import("@prisma/client")
    mockConstructEvent.mockReturnValue({
      id: "evt_duplicate_legacy",
      type: "checkout.session.completed",
      data: { object: { id: "cs_duplicate_legacy", payment_status: "paid", amount_total: 2000, currency: "usd" } },
    })
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )
    // The reclaim OR-clause deliberately excludes "legacy" (design §3) — the
    // atomic updateMany must not match a legacy row, so count stays 0.
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_duplicate_legacy",
      status: "legacy",
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_duplicate_legacy" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
  })

  it("returns 409 for a concurrent in-flight delivery of the same event", async () => {
    const { Prisma } = await import("@prisma/client")
    mockConstructEvent.mockReturnValue({
      id: "evt_in_flight",
      type: "checkout.session.completed",
      data: { object: { id: "cs_in_flight", payment_status: "paid", amount_total: 2000, currency: "usd" } },
    })
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_in_flight",
      status: "processing",
      updatedAt: new Date(),
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_in_flight" }),
      })
    )

    expect(res.status).toBe(409)
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
  })

  it("reclaims a stale in-flight event and reprocesses it (dead-worker recovery)", async () => {
    const { Prisma } = await import("@prisma/client")
    mockConstructEvent.mockReturnValue({
      id: "evt_stale_reclaim",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_stale_reclaim",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_stale_reclaim",
          customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
          },
        },
      },
    })
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )
    // The existing row's updatedAt is well past STALE_MS — the atomic
    // conditional reclaim (updateMany) matches it and re-claims processing.
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 1 })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_stale_reclaim" }),
      })
    )

    expect(res.status).toBe(200)
    // A stale reclaim must fall through to "claimed" and actually reprocess —
    // not be swallowed as a duplicate or in-flight no-op.
    expect(mockStripeWebhookEventFindUnique).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
  })

  it("never writes a StripeWebhookEvent row for a signature verification failure", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("invalid signature")
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_bad_sig" }),
      })
    )

    expect(res.status).toBe(400)
    expect(mockStripeWebhookEventCreate).not.toHaveBeenCalled()
  })

  it("still returns 200 when the completion write is exhausted after processing already succeeded", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mockConstructEvent.mockReturnValue({
      id: "evt_completion_exhausted",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_completion_exhausted",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_completion_exhausted",
          customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
          },
        },
      },
    })
    // Business processing succeeds (claim, upsert, sync, etc. all resolve via
    // beforeEach defaults) but every completion-write retry attempt fails —
    // this must NOT be confused with a processing failure (design §4 step 6).
    mockStripeWebhookEventUpdate.mockRejectedValue(new Error("completion write failed"))

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_completion_exhausted" }),
      })
    )

    // Business side effects already landed — must still report success to
    // Stripe so it does not retry an event that already fully processed.
    expect(res.status).toBe(200)
    expect(mockPurchaseUpsert).toHaveBeenCalledTimes(1)
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "stripe_webhook_completion_write_exhausted",
      expect.objectContaining({ eventId: "evt_completion_exhausted" })
    )

    consoleErrorSpy.mockRestore()
  })

  it("does not double-increment the day-of-week purchase counter when a paid kiosk event is reprocessed on redelivery", async () => {
    const { Prisma } = await import("@prisma/client")

    const buildEvent = () => ({
      id: "evt_dow_reprocess",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dow_reprocess",
          payment_status: "paid",
          amount_total: 2000,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_dow_reprocess",
          customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
          metadata: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Course booking",
            date: "2026-02-10",
            time: "11:00",
            serviceId: "dropin",
            userId: "guest",
            participants: "1",
            flowContext: "kiosk_terminal",
          },
        },
      },
    })

    // --- First delivery: claim succeeds; no existing DayOfWeekPurchaseCount
    // row for this user/day → the guard in incrementDayOfWeekCounter
    // (lib/checkin/day-of-week-counter.ts:44-46) creates one.
    mockConstructEvent.mockReturnValue(buildEvent())
    mockDayOfWeekFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const firstRes = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_dow_reprocess" }),
      })
    )

    expect(firstRes.status).toBe(200)
    expect(mockDayOfWeekCreate).toHaveBeenCalledTimes(1)
    expect(mockDayOfWeekUpdate).not.toHaveBeenCalled()

    // --- Second delivery (redelivery/reprocess of the SAME event.id): force
    // a stale-claim reclaim so processing genuinely reruns rather than being
    // swallowed as a duplicate at the claim layer (mirrors the existing
    // "reclaims a stale in-flight event" regression test above).
    mockConstructEvent.mockReturnValue(buildEvent())
    mockStripeWebhookEventCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 1 })
    // The row created on the first delivery now exists with lastCountedDate
    // matching the same ET calendar day as the purchase — the same-day guard
    // must fire and skip both create() and update() on the reprocess.
    mockDayOfWeekFindUnique.mockResolvedValueOnce({
      id: "dow_1",
      lastCountedDate: new Date("2026-02-10T12:00:00.000Z"),
    })

    const secondRes = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_dow_reprocess" }),
      })
    )

    expect(secondRes.status).toBe(200)
    // Reprocessing the same paid event must NOT double-increment the
    // counter: no additional create()/update() call on the redelivery.
    expect(mockDayOfWeekCreate).toHaveBeenCalledTimes(1)
    expect(mockDayOfWeekUpdate).not.toHaveBeenCalled()
  })

  it("does not crash or leave an unhandled rejection when Clerk's getUser times out and later rejects", async () => {
    vi.useFakeTimers()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }
    process.on("unhandledRejection", onUnhandledRejection)

    try {
      let rejectGetUser!: (err: Error) => void
      const hangingGetUser = new Promise((_resolve, reject) => {
        rejectGetUser = reject
      })
      const getUser = vi.fn().mockReturnValue(hangingGetUser)
      mockClerkClient.mockResolvedValue({ users: { getUser } })

      mockConstructEvent.mockReturnValue({
        id: "evt_clerk_timeout",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_clerk_timeout",
            payment_status: "paid",
            amount_total: 2000,
            currency: "usd",
            customer: "cus_123",
            payment_intent: "pi_clerk_timeout",
            customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
            metadata: {
              courseSlug: "salsa-femenina-matutina",
              courseTitle: "Course booking",
              date: "2026-02-10",
              time: "11:00",
              serviceId: "dropin",
              userId: "clerk_user_timeout",
              email: "test@example.com",
              phone: "9293876584",
              participants: "1",
            },
          },
        },
      })

      const { POST } = await import("@/app/api/stripe/webhook/route")
      const postPromise = POST(
        new Request("http://localhost/api/stripe/webhook", {
          method: "POST",
          body: JSON.stringify({ id: "evt_clerk_timeout" }),
        })
      )

      // Advance past the bounded Clerk timeout (CLERK_GET_USER_TIMEOUT_MS =
      // 5000ms, route.ts) deterministically — no real wall-clock wait — so
      // the race's timeout branch wins while getUser() is still hanging.
      await vi.advanceTimersByTimeAsync(5000)

      const res = await postPromise
      expect(res.status).toBe(200)
      expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith(
        expect.objectContaining({ clerkId: "clerk_user_timeout" })
      )

      // Simulate the underlying getUser() call finally rejecting AFTER the
      // race already settled on the timeout branch. This must be swallowed
      // by the .catch() attached directly to the getUser() promise itself
      // (route.ts ~144-147), never surfacing as an unhandled rejection.
      rejectGetUser(new Error("late clerk failure"))
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()

      expect(unhandledRejections).toEqual([])
    } finally {
      process.off("unhandledRejection", onUnhandledRejection)
      vi.useRealTimers()
    }
  })

  it("locks the consecutive-child pre-check to a metadata-path query, never a top-level parentPurchaseId column filter", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_precheck_lockin",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_precheck_lockin",
          payment_status: "paid",
          amount_total: 3500,
          currency: "usd",
          customer: "cus_123",
          payment_intent: "pi_precheck_lockin",
          customer_details: { email: "test@example.com", name: "Test User", phone: "+1 9293876584" },
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
        body: JSON.stringify({ id: "evt_precheck_lockin" }),
      })
    )

    expect(res.status).toBe(200)

    // Design §2b(b)/ADR-4c (baked-in constraint #1): the pre-check MUST stay
    // on metadata.path — historical consecutive-child rows never had the
    // parentPurchaseId column backfilled (§2b c), so a column-based pre-check
    // would silently create duplicate Purchases on a late reprocess.
    expect(mockPurchaseFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "db_user_1",
        metadata: { path: ["parentPurchaseId"], equals: "purchase_123" },
      },
      select: { id: true },
    })

    // Lock-in: a future refactor that switches the pre-check to a top-level
    // column where-clause must fail this test rather than silently pass.
    expect(mockPurchaseFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentPurchaseId: expect.anything() }),
      })
    )
  })
})
