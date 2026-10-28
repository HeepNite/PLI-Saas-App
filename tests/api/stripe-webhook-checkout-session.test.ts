import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockHeaders = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockSyncPackagePurchaseFromPaidPurchase = vi.fn()
const mockRevokeUnusedInternalPackagePurchaseTx = vi.fn()
const mockSyncScheduledAttendanceFromPurchase = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockPurchaseUpsert = vi.fn()
const mockPurchaseFindUnique = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCreate = vi.fn()
const mockPurchaseUpdate = vi.fn()
const mockPurchaseUpdateMany = vi.fn()
const mockConstructEvent = vi.fn()
const mockStripePaymentIntentRetrieve = vi.fn()
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
    updateMany: (...args: unknown[]) => mockPurchaseUpdateMany(...args),
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
  revokeUnusedInternalPackagePurchaseTx: (...args: unknown[]) => mockRevokeUnusedInternalPackagePurchaseTx(...args),
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
    paymentIntents = {
      retrieve: (...args: unknown[]) => mockStripePaymentIntentRetrieve(...args),
    }
    constructor() {}
  },
}))

describe("stripe webhook checkout session persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.STRIPE_SECRET_KEY = "sk_test"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "false")

    mockHeaders.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockSyncPackagePurchaseFromPaidPurchase.mockReset()
    mockRevokeUnusedInternalPackagePurchaseTx.mockReset()
    mockSyncScheduledAttendanceFromPurchase.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockPurchaseUpsert.mockReset()
    mockPurchaseFindUnique.mockReset()
    mockPurchaseFindFirst.mockReset()
    mockPurchaseCreate.mockReset()
    mockPurchaseUpdate.mockReset()
    mockPurchaseUpdateMany.mockReset()
    mockConstructEvent.mockReset()
    mockStripePaymentIntentRetrieve.mockReset()
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
    mockPurchaseUpdateMany.mockResolvedValue({ count: 1 })
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
    mockRevokeUnusedInternalPackagePurchaseTx.mockResolvedValue("revoked")
    mockSyncScheduledAttendanceFromPurchase.mockResolvedValue(undefined)
    mockAwardPointsFromRule.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  const internalEvent = async () => {
    vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
    const { issueInternalAttempt, internalIntentMetadata } = await import("@/lib/stripe/internal-purchase")
    const ticket = issueInternalAttempt({ terminalId: "terminal_live", sessionId: "session_live" }, "tmr_fixture", "student_1")
    return { id: "evt_internal", type: "payment_intent.succeeded", livemode: true, data: { object: {
      id: "pi_internal", object: "payment_intent", livemode: true, status: "succeeded", amount: 100,
      amount_received: 100, currency: "usd", customer: null, receipt_email: null,
      payment_method_types: ["card_present"], metadata: internalIntentMetadata(ticket, "purchase_internal_1"),
    } } }
  }
  const sendInternalEvent = async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route")
    return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed-event" }))
  }
  const expectNoInternalSideEffects = () => {
    for (const mock of [mockStripeWebhookEventCreate, mockPurchaseFindUnique, mockPurchaseFindFirst, mockPurchaseUpsert,
      mockPurchaseCreate, mockPurchaseUpdate, mockUpsertUserByIdentifiers, mockSyncScheduledAttendanceFromPurchase,
      mockSyncPackagePurchaseFromPaidPurchase, mockAwardPointsFromRule, mockPrisma.$transaction]) expect(mock).not.toHaveBeenCalled()
  }
  const preparedNativeEvent = async () => {
    vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
    const proof = await import("@/lib/stripe/prepared-native-payment")
    const fulfillmentMetadata = {
      courseSlug: "salsa", courseTitle: "Salsa", packageId: "package_dynamic_1", serviceId: "dropin", addons: "shoe-rental", participants: "2", coupon: "SAVE",
      packageLabel: "Ten classes", packageTotalCredits: "10", packageIsUnlimited: "false", packageCadence: "weekly", packageMakeUps: "1", packageValidDays: "180", date: "2026-10-04", time: "13:00",
    }
    const purchase = { id: "purchase_dynamic_1", userId: "user_dynamic_1", idempotencyKey: "native-m2-prepared:dynamic_1", stripePaymentIntentId: null, amount: 2599, currency: "usd", status: "pending", ...fulfillmentMetadata, metadata: fulfillmentMetadata }
    const preparedPurchase = { id: purchase.id, userId: purchase.userId, amount: purchase.amount, currency: purchase.currency, idempotencyKey: purchase.idempotencyKey, fulfillmentMetadata }
    const ticket = proof.issuePreparedNativePaymentAttempt({ terminalId: "terminal_dynamic", sessionId: "session_dynamic" }, { readerId: "tmr_dynamic", purchase: preparedPurchase })
    const intent = { id: "pi_dynamic_1", object: "payment_intent", livemode: true, status: "succeeded", amount: 2599, amount_received: 2599, currency: "usd", customer: null, receipt_email: null, payment_method_types: ["card_present"], metadata: proof.preparedNativePaymentMetadata(ticket, preparedPurchase) }
    return { event: { id: "evt_dynamic_1", type: "payment_intent.succeeded", livemode: true, data: { object: intent } }, purchase, intent }
  }
  const expectNoDynamicFallback = () => {
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
  }
  it("fulfills the exact stored prepared native package and service without ordinary checkout upsert", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "purchase_dynamic_1", status: { in: ["pending", "failed"] }, OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: "pi_dynamic_1" }] },
      data: { status: "paid", stripePaymentIntentId: "pi_dynamic_1" },
    }))
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_dynamic_1", purchaseId: "purchase_dynamic_1", source: "stripe_prepared_native",
      metadata: expect.objectContaining({ packageId: "package_dynamic_1", packageTotalCredits: "10" }),
    }))
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledWith(expect.objectContaining({
      purchaseId: "purchase_dynamic_1", courseSlug: "salsa", courseTitle: "Salsa", date: "2026-10-04", time: "13:00",
      source: "stripe_prepared_native",
    }))
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
  })
  it("commits the paid package before attendance and completes the event afterward", async () => {
    const { event, purchase } = await preparedNativeEvent()
    const order: string[] = []
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue(event)
    mockSyncPackagePurchaseFromPaidPurchase.mockImplementation(async () => { order.push("package"); return { id: "package_purchase_1", packageId: "package_dynamic_1" } })
    mockSyncScheduledAttendanceFromPurchase.mockImplementation(async () => { order.push("attendance") })
    mockStripeWebhookEventUpdate.mockImplementation(async ({ data }: { data: { status?: string } }) => { if (data.status === "completed") order.push("event:completed"); return {} })
    let commit = 0
    const transaction = async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const result = await callback(mockPrisma); order.push(`commit:${++commit}`); return result
    }
    mockPrisma.$transaction.mockImplementationOnce(transaction).mockImplementationOnce(transaction)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(order).toEqual(["package", "commit:1", "attendance", "event:completed", "commit:2"])
  })
  it("completes a prepared native tombstone without attendance or regrant", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue({ ...purchase, status: "reversed" })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", purchaseId: "purchase_dynamic_1" }) }))
  })
  type PreparedNativeFixture = Awaited<ReturnType<typeof preparedNativeEvent>>
  type PreparedNativeEventMutator = (event: PreparedNativeFixture["event"], purchase: PreparedNativeFixture["purchase"]) => unknown
  type PreparedNativePurchaseMutator = (purchase: PreparedNativeFixture["purchase"]) => unknown
  const preparedNativeTamperCases: Array<[string, PreparedNativeEventMutator, PreparedNativePurchaseMutator]> = [
    ["extra reserved metadata", (event) => ({ ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, extra: "no" } } } }), (purchase) => purchase],
    ["partial reserved metadata", (event) => ({ ...event, data: { object: { ...event.data.object, metadata: { flowContext: "pli_prepared_native_m2_v1" } } } }), (purchase) => purchase],
    ["amount substitution", (event) => ({ ...event, data: { object: { ...event.data.object, amount: 1 } } }), (purchase) => purchase],
    ["currency substitution", (event) => ({ ...event, data: { object: { ...event.data.object, currency: "eur" } } }), (purchase) => purchase],
    ["selection substitution", (event) => ({ ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, selectionDigest: "a".repeat(64) } } } }), (purchase) => purchase],
    ["idempotency substitution", (event) => event, (purchase) => ({ ...purchase, idempotencyKey: "native-m2-prepared:other" })],
    ["PaymentIntent substitution", (event) => event, (purchase) => ({ ...purchase, stripePaymentIntentId: "pi_other" })],
    ["Purchase substitution", (event) => ({ ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, purchaseId: "purchase_other" } } } }), (purchase) => purchase],
  ]
  it.each(preparedNativeTamperCases)("fails closed for prepared native %s without ordinary or USD1 fulfillment", async (_caseName, mutateEvent, mutatePurchase) => {
    const fixture = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(mutatePurchase(fixture.purchase))
    mockConstructEvent.mockReturnValue(mutateEvent(fixture.event, fixture.purchase))

    expect((await sendInternalEvent()).status).toBe(500)
    expectNoDynamicFallback()
  })
  it("retries a failed prepared native attendance sync with the same paid Purchase and PaymentIntent", async () => {
    const { event, purchase } = await preparedNativeEvent()
    const paid = { ...purchase, status: "paid", stripePaymentIntentId: "pi_dynamic_1" }
    mockPurchaseFindUnique.mockResolvedValueOnce(purchase).mockResolvedValueOnce(purchase).mockResolvedValueOnce(paid).mockResolvedValueOnce(paid)
    mockConstructEvent.mockReturnValue(event)
    mockSyncScheduledAttendanceFromPurchase.mockRejectedValueOnce(new Error("attendance unavailable"))

    expect((await sendInternalEvent()).status).toBe(500)
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))

    const { Prisma } = await import("@prisma/client")
    const p2002 = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    mockStripeWebhookEventCreate.mockRejectedValueOnce(p2002())
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 1 })
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledOnce()
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(2)
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledTimes(2)

    mockStripeWebhookEventCreate.mockRejectedValueOnce(p2002())
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({ eventId: event.id, status: "completed" })
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledTimes(2)
  })
  it.each([
    ["payment_intent.created", "requires_payment_method"],
    ["payment_intent.processing", "processing"],
  ])("acknowledges a prepared native %s as a no-op without fulfillment", async (type, status) => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue({ ...event, id: `evt_${type}`, type, data: { object: { ...event.data.object, status, amount_received: 0 } } })
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
    expect(info).toHaveBeenCalledWith("[native-m2-webhook:non-fulfilling-event-acknowledged]", { eventType: type })
    expectNoDynamicFallback()
    info.mockRestore()
  })
  const preparedNativeFailureEvent = async (type: "payment_intent.payment_failed" | "payment_intent.canceled") => {
    const fixture = await preparedNativeEvent()
    const declined = type === "payment_intent.payment_failed"
    const intent = {
      ...fixture.event.data.object, status: declined ? "requires_payment_method" : "canceled", amount_received: 0,
      last_payment_error: declined
        ? { message: "Your card was declined.", code: "card_declined", decline_code: "insufficient_funds", type: "card_error",
            payment_method: { card_present: { brand: "visa", last4: "4242" } } }
        : null,
    }
    return { ...fixture, event: { ...fixture.event, id: `evt_${type}`, type, created: 1_790_000_000, data: { object: intent } } }
  }
  it.each([
    ["payment_intent.payment_failed", "failed", { code: "card_declined", declineCode: "insufficient_funds", type: "card_error", message: "Your card was declined." }],
    ["payment_intent.canceled", "canceled", undefined],
  ] as const)("records a prepared native %s on the pending Purchase as %s with an allowlisted reason and no fulfillment", async (type, status, error) => {
    const { event, purchase } = await preparedNativeFailureEvent(type)
    const bound = { ...purchase, stripePaymentIntentId: "pi_dynamic_1" }
    mockPurchaseFindUnique.mockResolvedValue(bound)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledOnce()
    const at = new Date(1_790_000_000 * 1000).toISOString()
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith({
      where: { id: "purchase_dynamic_1", status: { in: ["pending", "failed", "canceled"] }, OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: "pi_dynamic_1" }] },
      data: {
        status,
        metadata: {
          ...purchase.metadata,
          stripeFailure: {
            eventType: type, occurredAt: at, paymentIntentId: "pi_dynamic_1",
            ...(error ? { error } : {}),
          },
          paymentAttempts: [{
            at, channel: "native_m2", status, paymentIntentId: "pi_dynamic_1",
            ...(error ? { code: error.code, declineCode: error.declineCode } : {}),
          }],
        },
      },
    })
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", purchaseId: "purchase_dynamic_1" }) }))
    expectNoDynamicFallback()
  })
  it("records a second decline on an already failed prepared native Purchase without losing the first attempt", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.payment_failed")
    const first = { at: "2026-10-04T16:59:00.000Z", channel: "native_m2", status: "failed", code: "card_declined", declineCode: "do_not_honor", paymentIntentId: "pi_dynamic_1" }
    mockPurchaseFindUnique.mockResolvedValue({
      ...purchase, status: "failed", stripePaymentIntentId: "pi_dynamic_1",
      metadata: { ...purchase.metadata, stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: first.at, error: { code: "card_declined", declineCode: "do_not_honor" } }, paymentAttempts: [first] },
    })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    const data = mockPurchaseUpdateMany.mock.calls[0][0].data as { status: string; metadata: { stripeFailure: { error: { declineCode: string } }; paymentAttempts: Array<{ declineCode?: string }> } }
    expect(data.status).toBe("failed")
    expect(data.metadata.stripeFailure.error.declineCode).toBe("insufficient_funds")
    expect(data.metadata.paymentAttempts.map((attempt) => attempt.declineCode)).toEqual(["do_not_honor", "insufficient_funds"])
  })
  it("appends embedded card and checkout attempts to the attempt log", async () => {
    mockPurchaseFindUnique.mockResolvedValueOnce({
      id: "purchase_embedded", status: "failed", metadata: { paymentAttempts: [{ at: "2026-10-04T16:00:00.000Z", channel: "card", status: "failed", code: "card_declined" }] },
    })
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_embedded_failed", type: "payment_intent.payment_failed", created: 1_790_000_000,
      data: { object: { id: "pi_embedded", metadata: {}, last_payment_error: { code: "expired_card", type: "card_error" } } },
    })
    const { POST } = await import("@/app/api/stripe/webhook/route")
    expect((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))).status).toBe(200)
    expect(mockPurchaseUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "failed",
      metadata: expect.objectContaining({ paymentAttempts: [
        { at: "2026-10-04T16:00:00.000Z", channel: "card", status: "failed", code: "card_declined" },
        { at: new Date(1_790_000_000 * 1000).toISOString(), channel: "card", status: "failed", code: "expired_card", paymentIntentId: "pi_embedded" },
      ] }),
    }) }))

    mockPurchaseFindUnique.mockResolvedValueOnce({ id: "purchase_qr", status: "pending", metadata: {} })
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_qr_expired", type: "checkout.session.expired", created: 1_790_000_000,
      data: { object: { id: "cs_qr", metadata: {} } },
    })
    expect((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))).status).toBe(200)
    expect(mockPurchaseUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "expired",
      metadata: expect.objectContaining({ paymentAttempts: [
        { at: new Date(1_790_000_000 * 1000).toISOString(), channel: "checkout", status: "expired", checkoutSessionId: "cs_qr" },
      ] }),
    }) }))
  })
  const canceledThenReopened = (purchase: { metadata: Record<string, string> }) => ({
    ...purchase, status: "pending", stripePaymentIntentId: null,
    metadata: { ...purchase.metadata, paymentAttemptGeneration: "1", paymentAttempts: [{ at: "2026-10-04T16:59:00.000Z", channel: "native_m2", status: "canceled", paymentIntentId: "pi_dynamic_1" }] },
  })
  it("ignores a late failure event for a canceled PaymentIntent after the Purchase was reopened for retry", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.canceled")
    mockPurchaseFindUnique.mockResolvedValue(canceledThenReopened(purchase))
    mockConstructEvent.mockReturnValue(event)
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
  })
  it("completes a payment_intent.canceled already recorded by the kiosk cancel without logging it twice", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.canceled")
    mockPurchaseFindUnique.mockResolvedValue({
      ...purchase, status: "canceled", stripePaymentIntentId: "pi_dynamic_1",
      metadata: { ...purchase.metadata, paymentAttempts: [{ at: "2026-10-04T16:59:00.000Z", channel: "native_m2", status: "canceled", paymentIntentId: "pi_dynamic_1" }] },
    })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", purchaseId: "purchase_dynamic_1" }) }))
    expectNoDynamicFallback()
  })
  it("pays a reopened canceled Purchase when the retry PaymentIntent succeeds", async () => {
    const { event, purchase } = await preparedNativeEvent()
    const retry = { ...event, id: "evt_retry_succeeded", data: { object: { ...event.data.object, id: "pi_retry_1" } } }
    mockPurchaseFindUnique.mockResolvedValue(canceledThenReopened(purchase))
    mockConstructEvent.mockReturnValue(retry)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "paid", stripePaymentIntentId: "pi_retry_1" } }))
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalled()
  })
  it("never downgrades a prepared native Purchase that is no longer pending", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.payment_failed")
    mockPurchaseFindUnique.mockResolvedValue({ ...purchase, status: "paid", stripePaymentIntentId: "pi_dynamic_1" })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }))
    expectNoDynamicFallback()
  })
  it("acknowledges a prepared native failure whose PaymentIntent is bound elsewhere without recording or binding it", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.payment_failed")
    mockPurchaseFindUnique.mockResolvedValue({ ...purchase, stripePaymentIntentId: "pi_other" })
    mockConstructEvent.mockReturnValue(event)
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockPurchaseUpdate).not.toHaveBeenCalled()
    expectNoDynamicFallback()
  })
  it("records a prepared native failure only once across a duplicate delivery", async () => {
    const { event, purchase } = await preparedNativeFailureEvent("payment_intent.payment_failed")
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    const { Prisma } = await import("@prisma/client")
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }))
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({ eventId: event.id, status: "completed" })
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledOnce()
  })
  it("fulfills a prepared native success after an earlier recorded decline on the same PaymentIntent", async () => {
    const { event, purchase } = await preparedNativeEvent()
    const declined = {
      ...purchase, status: "failed", stripePaymentIntentId: "pi_dynamic_1",
      metadata: { ...purchase.metadata, stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "2026-10-04T17:00:00.000Z", error: { code: "card_declined" } } },
    }
    mockPurchaseFindUnique.mockResolvedValue(declined)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "purchase_dynamic_1", status: { in: ["pending", "failed"] }, OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: "pi_dynamic_1" }] },
      data: { status: "paid", stripePaymentIntentId: "pi_dynamic_1" },
    }))
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ packageId: "package_dynamic_1", packageTotalCredits: "10" }),
    }))
  })
  it("acknowledges a prepared native charge.succeeded carrying copied PaymentIntent metadata without fulfillment", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue({
      id: "evt_charge_succeeded", type: "charge.succeeded", livemode: true,
      data: { object: { id: "ch_dynamic_1", object: "charge", payment_intent: "pi_dynamic_1", amount: 2599, currency: "usd", metadata: event.data.object.metadata } },
    })
    vi.spyOn(console, "info").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expectNoDynamicFallback()
  })
  it("still fulfills a prepared native payment_intent.succeeded exactly once across a duplicate delivery", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(purchase)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    const { Prisma } = await import("@prisma/client")
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }))
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({ eventId: event.id, status: "completed" })
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).toHaveBeenCalledOnce()
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledOnce()
    expect(mockSyncScheduledAttendanceFromPurchase).toHaveBeenCalledOnce()
  })
  const preparedNativeReversalEvent = (type: "charge.refunded" | "charge.dispute.created", metadata?: Record<string, string>) => ({
    id: `evt_native_${type.replaceAll(".", "_")}`, type, livemode: true,
    data: { object: type === "charge.refunded"
      ? { id: "ch_dynamic_1", object: "charge", payment_intent: "pi_dynamic_1", amount: 2599, amount_refunded: 2599, refunded: true, currency: "usd", metadata }
      : { id: "dp_dynamic_1", object: "dispute", payment_intent: "pi_dynamic_1", amount: 2599, currency: "usd", metadata: {} } },
  })
  it("records a prepared native refund for manual resolution without fulfillment or credit mutation", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === purchase.id ? { ...purchase, status: "paid", stripePaymentIntentId: "pi_dynamic_1" } : null)
    mockConstructEvent.mockReturnValue(preparedNativeReversalEvent("charge.refunded", event.data.object.metadata))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "prepared_native_reversal_requires_review", purchaseId: "purchase_dynamic_1" }),
    }))
    expect(warn).toHaveBeenCalledWith("[native-m2-reversal:manual-resolution-required]", {
      eventId: "evt_native_charge_refunded", eventType: "charge.refunded", purchaseId: "purchase_dynamic_1",
    })
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
    expect(mockStripePaymentIntentRetrieve).not.toHaveBeenCalled()
    expectNoDynamicFallback()
    warn.mockRestore()
  })
  it("records a prepared native dispute bound by PaymentIntent for manual resolution", async () => {
    const { purchase } = await preparedNativeEvent()
    const paid = { ...purchase, status: "paid", stripePaymentIntentId: "pi_dynamic_1", metadata: { ...purchase.metadata, paymentSurface: "native_m2_prepare" } }
    mockPurchaseFindUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.stripePaymentIntentId === "pi_dynamic_1" || where.id === purchase.id ? paid : null)
    mockConstructEvent.mockReturnValue(preparedNativeReversalEvent("charge.dispute.created"))
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "prepared_native_reversal_requires_review", purchaseId: "purchase_dynamic_1" }),
    }))
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
  })
  it("records a prepared native refund with a missing Purchase for manual resolution without fabricating a binding", async () => {
    const { event } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue(null)
    mockConstructEvent.mockReturnValue(preparedNativeReversalEvent("charge.refunded", event.data.object.metadata))
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect((await sendInternalEvent()).status).toBe(200)
    const manual = mockStripeWebhookEventUpdate.mock.calls.find(([arg]) => arg.data.status === "manual_resolution")
    expect(manual?.[0].data).toEqual(expect.objectContaining({ resolutionReason: "prepared_native_purchase_binding_missing" }))
    expect(manual?.[0].data).not.toHaveProperty("purchaseId")
  })
  it("dispatches a signed succeeded internal payment to one fixed-credit fulfillment without ordinary checkout effects", async () => {
    const event = await internalEvent()
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_ENABLED", "false")
    vi.stubEnv("INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED", "false")
    const { internalAttemptKey } = await import("@/lib/stripe/internal-purchase")
    mockPurchaseFindUnique.mockResolvedValue({
      id: "purchase_internal_1", userId: "student_1", idempotencyKey: internalAttemptKey(event.data.object.metadata.pliInternalAttempt), stripePaymentIntentId: null,
      amount: 100, currency: "usd", status: "pending", courseSlug: "general-class-credit", packageId: "pli-internal-general-class-credit-v1",
      metadata: { flowContext: "pli_internal_purchase_v1", attemptId: event.data.object.metadata.attemptId, recipientUserId: "student_1", creditType: "general_class_credit", creditQuantity: 1 },
    })
    mockConstructEvent.mockReturnValue(event)
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockConstructEvent).toHaveBeenCalled()
    expect(mockSyncPackagePurchaseFromPaidPurchase).toHaveBeenCalledWith(expect.objectContaining({
      userId: "student_1", purchaseId: "purchase_internal_1", metadata: expect.objectContaining({
        packageId: "pli-internal-general-class-credit-v1", packageTotalCredits: "1", packageIsUnlimited: "false",
      }),
    }))
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
  })
  const boundInternalPurchase = async (event: Awaited<ReturnType<typeof internalEvent>>, overrides: Record<string, unknown> = {}) => {
    const { internalAttemptKey } = await import("@/lib/stripe/internal-purchase")
    return {
      id: "purchase_internal_1", userId: "student_1", idempotencyKey: internalAttemptKey(event.data.object.metadata.pliInternalAttempt),
      stripePaymentIntentId: "pi_internal", amount: 100, currency: "usd", status: "paid",
      courseSlug: "general-class-credit", packageId: "pli-internal-general-class-credit-v1",
      metadata: {
        flowContext: "pli_internal_purchase_v1", attemptId: event.data.object.metadata.attemptId,
        recipientUserId: "student_1", creditType: "general_class_credit", creditQuantity: 1,
      },
      ...overrides,
    }
  }
  const internalReversalEvent = async (type: "charge.refunded" | "charge.dispute.created", overrides: Record<string, unknown> = {}) => {
    const paid = await internalEvent()
    const object = type === "charge.refunded"
      ? { id: "ch_internal", object: "charge", payment_intent: "pi_internal", amount: 100, amount_refunded: 100, refunded: true, currency: "usd" }
      : { id: "dp_internal", object: "dispute", payment_intent: "pi_internal", amount: 100, currency: "usd" }
    return { event: { id: `evt_${type.replaceAll(".", "_")}`, type, livemode: true, data: { object: { ...object, ...overrides } } }, paid }
  }

  it("defaults reversal handling OFF: it tombstones and persists manual resolution without provider or credit effects", async () => {
    const { event, paid } = await internalReversalEvent("charge.refunded")
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(paid))
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripePaymentIntentRetrieve).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "purchase_internal_1", status: { in: ["pending", "paid"] } },
      data: { status: "reversed" },
    }))
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "reversal_feature_disabled", purchaseId: "purchase_internal_1" }),
    }))
  })

  it.each(["charge.refunded", "charge.dispute.created"] as const)("revokes one unused internal credit for signed %s", async (type) => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const { event, paid } = await internalReversalEvent(type)
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(paid))
    mockStripePaymentIntentRetrieve.mockResolvedValue(paid.data.object)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripePaymentIntentRetrieve).toHaveBeenCalledWith("pi_internal")
    expect(mockRevokeUnusedInternalPackagePurchaseTx).toHaveBeenCalledWith(mockPrisma, {
      purchaseId: "purchase_internal_1", userId: "student_1",
    })
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
  })

  it("keeps concurrent refund and dispute reversals idempotent", async () => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const refund = await internalReversalEvent("charge.refunded")
    const dispute = await internalReversalEvent("charge.dispute.created")
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(refund.paid))
    mockStripePaymentIntentRetrieve.mockResolvedValue(refund.paid.data.object)
    mockRevokeUnusedInternalPackagePurchaseTx.mockResolvedValueOnce("revoked").mockResolvedValueOnce("already-revoked")
    const { POST } = await import("@/app/api/stripe/webhook/route")

    mockConstructEvent.mockReturnValue(refund.event)
    expect((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed-refund" }))).status).toBe(200)
    mockConstructEvent.mockReturnValue(dispute.event)
    expect((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed-dispute" }))).status).toBe(200)
    expect(mockRevokeUnusedInternalPackagePurchaseTx).toHaveBeenCalledTimes(2)
  })

  it("records a consumed or missing internal credit for manual resolution without mutating it", async () => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const { event, paid } = await internalReversalEvent("charge.refunded")
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(paid))
    mockStripePaymentIntentRetrieve.mockResolvedValue(paid.data.object)
    mockRevokeUnusedInternalPackagePurchaseTx.mockResolvedValue("manual-resolution")
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockRevokeUnusedInternalPackagePurchaseTx).toHaveBeenCalledTimes(1)
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "credit_consumed_or_ambiguous", purchaseId: "purchase_internal_1" }),
    }))
  })

  it("records an explicitly marked reversal with a missing Purchase for manual resolution without fabricating one", async () => {
    const { event } = await internalReversalEvent("charge.refunded", { metadata: { flowContext: "pli_internal_purchase_v1" } })
    mockPurchaseFindUnique.mockResolvedValue(null)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripePaymentIntentRetrieve).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "purchase_binding_missing" }),
    }))
  })

  it.each([
    ["partial refund", { amount_refunded: 50, refunded: false }, {}],
    ["binding mismatch", {}, { metadata: { flowContext: "pli_internal_purchase_v1", attemptId: "different", recipientUserId: "student_1", creditType: "general_class_credit", creditQuantity: 1 } }],
  ])("records %s reversal for terminal manual resolution without mutating credit", async (_caseName, eventOverrides, purchaseOverrides) => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const { event, paid } = await internalReversalEvent("charge.refunded", eventOverrides)
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(paid, purchaseOverrides))
    mockStripePaymentIntentRetrieve.mockResolvedValue(paid.data.object)
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "internal_binding_invalid", purchaseId: "purchase_internal_1" }),
    }))
  })

  it("keeps an ordinary signed refund outside internal reversal handling without PaymentIntent retrieval", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_ordinary_refund", type: "charge.refunded", livemode: true,
      data: { object: { id: "ch_ordinary", object: "charge", payment_intent: "pi_ordinary", amount: 1000, amount_refunded: 1000, refunded: true, currency: "usd" } },
    })

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripePaymentIntentRetrieve).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
  })

  it("uses fresh package outcomes after reversal-before-paid instead of stale Purchase status", async () => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const { event, paid } = await internalReversalEvent("charge.refunded", {
      metadata: { flowContext: "pli_internal_purchase_v1", purchaseId: "purchase_internal_1" },
    })
    const pending = await boundInternalPurchase(paid, { status: "pending", stripePaymentIntentId: null })
    mockPurchaseFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(pending).mockResolvedValueOnce(pending)
    mockStripePaymentIntentRetrieve.mockResolvedValue(paid.data.object)
    mockRevokeUnusedInternalPackagePurchaseTx.mockResolvedValue("not-materialized")
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseFindUnique).toHaveBeenNthCalledWith(1, { where: { stripePaymentIntentId: "pi_internal" } })
    expect(mockPurchaseFindUnique).toHaveBeenNthCalledWith(2, { where: { id: "purchase_internal_1" } })
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "purchase_internal_1", status: { in: ["pending", "paid"] },
        OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: "pi_internal" }],
      },
      data: { status: "reversed" },
    }))
    expect(mockRevokeUnusedInternalPackagePurchaseTx).toHaveBeenCalledWith(mockPrisma, {
      purchaseId: "purchase_internal_1", userId: "student_1",
    })
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
  })

  it("does not automatically reverse an internal purchase bound to another PaymentIntent", async () => {
    vi.stubEnv("INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED", "true")
    const { event, paid } = await internalReversalEvent("charge.refunded", {
      metadata: { flowContext: "pli_internal_purchase_v1", purchaseId: "purchase_internal_1" },
    })
    mockPurchaseFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(
      await boundInternalPurchase(paid, { status: "pending", stripePaymentIntentId: "pi_other" }),
    )
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockStripePaymentIntentRetrieve).not.toHaveBeenCalled()
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "purchase_binding_missing" }),
    }))
  })

  it("fails closed when paid races a reversal tombstone", async () => {
    const event = await internalEvent()
    const pending = await boundInternalPurchase(event, { status: "pending", stripePaymentIntentId: null })
    const tombstoned = await boundInternalPurchase(event, { status: "reversed", stripePaymentIntentId: null })
    mockPurchaseFindUnique.mockResolvedValueOnce(pending).mockResolvedValueOnce(tombstoned)
    mockPurchaseUpdateMany.mockResolvedValue({ count: 0 })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed", purchaseId: "purchase_internal_1" }),
    }))
  })

  it("does not regrant a credit on a later signed paid-event replay after a reversal tombstone", async () => {
    const event = await internalEvent()
    mockPurchaseFindUnique.mockResolvedValue(await boundInternalPurchase(event, { status: "reversed" }))
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
    expect(mockRevokeUnusedInternalPackagePurchaseTx).not.toHaveBeenCalled()
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed", purchaseId: "purchase_internal_1" }),
    }))
  })

  it("rejects internal fulfillment when the Purchase attempt binding differs from the signed PaymentIntent", async () => {
    const event = await internalEvent()
    const { internalAttemptKey } = await import("@/lib/stripe/internal-purchase")
    mockPurchaseFindUnique.mockResolvedValue({
      id: "purchase_internal_1", userId: "student_1", idempotencyKey: internalAttemptKey(event.data.object.metadata.pliInternalAttempt), stripePaymentIntentId: null,
      amount: 100, currency: "usd", status: "pending", courseSlug: "general-class-credit", packageId: "pli-internal-general-class-credit-v1",
      metadata: { flowContext: "pli_internal_purchase_v1", attemptId: "other-attempt", recipientUserId: "student_1", creditType: "general_class_credit", creditQuantity: 1 },
    })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(500)
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
  })
  it.each(["payment_intent.payment_failed", "payment_intent.canceled"])(
    "keeps signed internal %s out of ordinary checkout handling", async (type) => {
      const event = await internalEvent()
      const status = type === "payment_intent.canceled" ? "canceled" : "requires_payment_method"
      mockConstructEvent.mockReturnValue({ ...event, type, data: { object: { ...event.data.object, status, amount_received: 0 } } })
      expect((await sendInternalEvent()).status).toBe(200)
      expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
      expect(mockPurchaseUpsert).not.toHaveBeenCalled()
      expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { eventId: event.id },
        data: expect.objectContaining({ status: "completed" }),
      }))
    },
  )
  it("does not rematerialize a credit when a completed internal webhook is replayed", async () => {
    const { Prisma } = await import("@prisma/client")
    const event = await internalEvent()
    mockConstructEvent.mockReturnValue(event)
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002", clientVersion: "test",
    }))
    mockStripeWebhookEventUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({ eventId: event.id, status: "completed" })
    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
  })
  it("still rejects invalid Stripe signatures before internal exclusion", async () => {
    await internalEvent()
    mockConstructEvent.mockImplementation(() => { throw new Error("invalid signature") })
    expect((await sendInternalEvent()).status).toBe(400)
    expectNoInternalSideEffects()
  })
  it.each(["partial", "tampered", "wrong_amount", "test_mode", "missing_signing_key"])(
    "never acknowledges an unproven internal marker (%s)", async (mismatch) => {
      const event = await internalEvent()
      if (mismatch === "partial") delete event.data.object.metadata.pliInternalAttempt
      if (mismatch === "tampered") event.data.object.metadata.terminalId = "other_terminal"
      if (mismatch === "wrong_amount") event.data.object.amount = 200
      if (mismatch === "test_mode") event.livemode = false
      if (mismatch === "missing_signing_key") vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", undefined)
      mockConstructEvent.mockReturnValue(event)
      expect((await sendInternalEvent()).status).toBeGreaterThanOrEqual(400)
      expectNoInternalSideEffects()
    },
  )

  // Verify "Collected" (D4) means staff already took the money at the desk. A later card success
  // for the same purchase must not fulfill again; it is recorded for manual resolution (refund one).
  const collectedResolution = { action: "collected", by: "staff_1", byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: null, previousPaymentChannel: "card" }
  const expectCollectedManualResolution = (purchaseId: string) => {
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "manual_resolution", resolutionReason: "verify_collected_then_card_succeeded", purchaseId }),
    }))
    expect(mockStripeWebhookEventUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }))
    expect(mockPurchaseUpsert).not.toHaveBeenCalled()
    expect(mockSyncPackagePurchaseFromPaidPurchase).not.toHaveBeenCalled()
    expect(mockSyncScheduledAttendanceFromPurchase).not.toHaveBeenCalled()
  }

  it("records a prepared native success on a purchase already collected at the desk for manual resolution", async () => {
    const { event, purchase } = await preparedNativeEvent()
    mockPurchaseFindUnique.mockResolvedValue({
      ...purchase, status: "paid",
      metadata: { ...purchase.metadata, paymentChannel: "cash", settlementStatus: "paid", verifyResolution: collectedResolution },
    })
    mockConstructEvent.mockReturnValue(event)

    expect((await sendInternalEvent()).status).toBe(200)
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
    expectCollectedManualResolution("purchase_dynamic_1")
  })

  it("records a hosted checkout success on a purchase already collected at the desk for manual resolution", async () => {
    mockPurchaseFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.stripeCheckoutSessionId === "cs_collected"
        ? { id: "purchase_collected", metadata: { paymentChannel: "cash", settlementStatus: "paid", verifyResolution: collectedResolution } }
        : null)
    mockConstructEvent.mockReturnValue({
      id: "evt_collected_checkout",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_collected", payment_status: "paid", amount_total: 2000, currency: "usd", customer: "cus_123", payment_intent: "pi_collected",
        customer_details: { email: "test@example.com", name: "Test User", phone: null },
        metadata: { courseSlug: "salsa", courseTitle: "Salsa", date: "2026-10-23", time: "18:00", userId: "guest", email: "test@example.com" },
      } },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed-event" }))

    expect(res.status).toBe(200)
    expectCollectedManualResolution("purchase_collected")
  })

  it("records a payment_intent success bound to a purchase already collected at the desk for manual resolution", async () => {
    mockPurchaseFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.stripePaymentIntentId === "pi_collected_card"
        ? { id: "purchase_collected_card", metadata: { paymentChannel: "cash", settlementStatus: "paid", verifyResolution: collectedResolution } }
        : null)
    mockConstructEvent.mockReturnValue({
      id: "evt_collected_pi",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_collected_card", object: "payment_intent", status: "succeeded", amount: 2000, currency: "usd", customer: null, receipt_email: null, metadata: {} } },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed-event" }))

    expect(res.status).toBe(200)
    expectCollectedManualResolution("purchase_collected_card")
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

  it("keeps the submitted booking name ahead of the Stripe cardholder name", async () => {
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
            name: "Ga Barri",
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
        create: expect.objectContaining({ name: "Ga Barri" }),
        update: expect.objectContaining({ name: "Ga Barri" }),
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

  it.each([undefined, "pli_internal_purchase_unknown"])("normalizes ordinary intent success with marker %s to paid before persisting", async (flowContext) => {
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
            flowContext,
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
