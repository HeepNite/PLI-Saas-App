import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

const mockCreate = vi.fn()
const mockIssueFindUnique = vi.fn()
const mockIssueUpdateMany = vi.fn()
const mockUpdateMany = vi.fn()
const mockFindUnique = vi.fn()
const mockPurchaseFindUnique = vi.fn()
const mockPurchaseCreate = vi.fn()
const mockPurchaseUpdateMany = vi.fn()
const transactionClient = {
  preparedNativePurchase: {
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    findUnique: (...args: unknown[]) => mockFindUnique(...args),
  },
}
const mockTransaction = vi.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => mockTransaction(callback),
    preparedNativePurchase: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockIssueFindUnique(...args),
      updateMany: (...args: unknown[]) => mockIssueUpdateMany(...args),
    },
    purchase: {
      findUnique: (...args: unknown[]) => mockPurchaseFindUnique(...args),
      create: (...args: unknown[]) => mockPurchaseCreate(...args),
      updateMany: (...args: unknown[]) => mockPurchaseUpdateMany(...args),
    },
  },
}))

const caller = { terminalId: "terminal_1", sessionId: "session_1" }
const now = new Date("2026-10-04T17:00:00.000Z")

describe("prepared native purchase capability", () => {
  // These mocks exercise control flow only; they do not establish real PostgreSQL concurrency.
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    mockCreate.mockReset()
    mockIssueFindUnique.mockReset()
    mockIssueUpdateMany.mockReset()
    mockUpdateMany.mockReset()
    mockFindUnique.mockReset()
    mockPurchaseFindUnique.mockReset()
    mockPurchaseCreate.mockReset()
    mockPurchaseUpdateMany.mockReset()
    mockTransaction.mockClear()
  })

  afterEach(() => vi.useRealTimers())

  it("issues only a random opaque reference while persisting its digest and fixed expiry", async () => {
    mockCreate.mockResolvedValue({ id: "capability_1" })
    const { issuePreparedNativePurchase, PREPARED_NATIVE_PURCHASE_TTL_MS } = await import("@/lib/stripe/prepared-native-purchase")

    const reference = await issuePreparedNativePurchase({ purchaseId: "purchase_1", ...caller })

    expect(reference).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(mockCreate).toHaveBeenCalledWith({ data: {
      purchaseId: "purchase_1", terminalId: caller.terminalId, sessionId: caller.sessionId,
      referenceHash: createHash("sha256").update(reference).digest("hex"),
      expiresAt: new Date(now.getTime() + PREPARED_NATIVE_PURCHASE_TTL_MS),
    } })
  })

  it("reissues an expired unconsumed capability for the same purchase and caller without creating a second row", async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: "capability_1", purchaseId: "purchase_1", terminalId: caller.terminalId, sessionId: caller.sessionId,
      consumedAt: null, expiresAt: new Date(now.getTime() - 1),
    })
    mockIssueUpdateMany.mockResolvedValue({ count: 1 })
    const { issuePreparedNativePurchase, PREPARED_NATIVE_PURCHASE_TTL_MS } = await import("@/lib/stripe/prepared-native-purchase")

    const reference = await issuePreparedNativePurchase({ purchaseId: "purchase_1", ...caller })

    expect(reference).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockIssueUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "capability_1", terminalId: caller.terminalId, sessionId: caller.sessionId,
        consumedAt: null, expiresAt: { lte: now },
      },
      data: {
        referenceHash: createHash("sha256").update(reference).digest("hex"),
        expiresAt: new Date(now.getTime() + PREPARED_NATIVE_PURCHASE_TTL_MS),
      },
    })
  })

  it("does not rotate a still-valid capability", async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: "capability_1", terminalId: caller.terminalId, sessionId: caller.sessionId,
      consumedAt: null, expiresAt: new Date(now.getTime() + 1),
    })
    const { issuePreparedNativePurchase, PreparedNativePurchaseError } = await import("@/lib/stripe/prepared-native-purchase")

    await expect(issuePreparedNativePurchase({ purchaseId: "purchase_1", ...caller })).rejects.toMatchObject({
      name: PreparedNativePurchaseError.name, code: "unavailable", status: 409,
    })
    expect(mockIssueUpdateMany).not.toHaveBeenCalled()
  })

  it("does not reset a consumed capability", async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: "capability_1", purchaseId: "purchase_1", terminalId: caller.terminalId, sessionId: caller.sessionId, consumedAt: now,
    })
    const { issuePreparedNativePurchase, PreparedNativePurchaseError } = await import("@/lib/stripe/prepared-native-purchase")

    await expect(issuePreparedNativePurchase({ purchaseId: "purchase_1", ...caller })).rejects.toMatchObject({
      name: PreparedNativePurchaseError.name, code: "unavailable", status: 409,
    })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockIssueUpdateMany).not.toHaveBeenCalled()
  })

  it("atomically consumes an unexpired capability for its original caller and returns only its purchase identity", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockFindUnique.mockResolvedValue({ purchaseId: "purchase_1" })
    const { consumePreparedNativePurchase } = await import("@/lib/stripe/prepared-native-purchase")
    const reference = "A".repeat(43)

    await expect(consumePreparedNativePurchase(reference, caller)).resolves.toEqual({ purchaseId: "purchase_1" })
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        referenceHash: createHash("sha256").update(reference).digest("hex"),
        terminalId: caller.terminalId, sessionId: caller.sessionId, consumedAt: null, expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    })
  })

  it("persists only the server-resolved selection and rejects a reused purchase with substituted metadata", async () => {
    const { buildNativePreparedPurchaseIdempotencyKey, createOrReuseNativePreparedPurchase, NativePreparedPurchaseError } = await import("@/lib/checkout/prepared-native-purchase-create")
    const input = {
      preparedContextId: "prepared_ctx_1",
      recipient: { userId: "user_123", email: "student@example.com", name: "Student", phone: "9293876584" },
      selection: {
        courseSlug: "salsa-femenina-matutina", courseTitle: "Course booking", amount: 2000, currency: "usd",
        packageId: "", serviceId: "dropin", addons: ["shoes"], participants: 2, coupon: "PLI10",
      },
      fulfillmentMetadata: { courseSlug: "salsa-femenina-matutina", date: "2026-02-10", time: "11:00", serviceId: "dropin" },
    }
    mockPurchaseFindUnique.mockResolvedValue(null)
    mockPurchaseCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "purchase_1", ...data }))

    const purchase = await createOrReuseNativePreparedPurchase(input)

    expect(purchase.id).toBe("purchase_1")
    expect(buildNativePreparedPurchaseIdempotencyKey(input)).not.toBe(
      buildNativePreparedPurchaseIdempotencyKey({ ...input, preparedContextId: "prepared_ctx_2" })
    )
    expect(mockPurchaseCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "user_123", amount: 2000, currency: "usd", courseSlug: "salsa-femenina-matutina", serviceId: "dropin",
      packageId: null, addonsCsv: "shoes", participants: 2, coupon: "PLI10", status: "pending",
      metadata: expect.objectContaining({ recipientUserId: "user_123", preparedContextId: "prepared_ctx_1" }),
    }) })
    const existing = { ...purchase, metadata: { ...(purchase.metadata as Record<string, unknown>), date: "substituted" } }
    mockPurchaseFindUnique.mockResolvedValue(existing)

    await expect(createOrReuseNativePreparedPurchase(input)).rejects.toMatchObject({
      name: NativePreparedPurchaseError.name, code: "mismatch", status: 409,
    })
  })

  const reuseInput = {
    preparedContextId: "prepared_ctx_1",
    recipient: { userId: "user_123", email: "student@example.com", name: "Student", phone: "9293876584" },
    selection: {
      courseSlug: "salsa-femenina-matutina", courseTitle: "Course booking", amount: 2000, currency: "usd",
      packageId: "", serviceId: "dropin", addons: ["shoes"], participants: 2, coupon: "PLI10",
    },
    fulfillmentMetadata: { courseSlug: "salsa-femenina-matutina", date: "2026-02-10", time: "11:00", serviceId: "dropin" },
  }
  const storedPurchase = async () => {
    const { buildNativePreparedPurchaseIdempotencyKey } = await import("@/lib/checkout/prepared-native-purchase-create")
    return {
      id: "purchase_1", userId: "user_123", courseSlug: "salsa-femenina-matutina", courseTitle: "Course booking", amount: 2000,
      currency: "usd", status: "pending", email: "student@example.com", name: "Student", phone: "9293876584", participants: 2,
      coupon: "PLI10", packageId: null, serviceId: "dropin", addonsCsv: "shoes",
      idempotencyKey: buildNativePreparedPurchaseIdempotencyKey(reuseInput),
      metadata: { ...reuseInput.fulfillmentMetadata, paymentSurface: "native_m2_prepare", preparedContextId: "prepared_ctx_1", recipientUserId: "user_123" },
    }
  }
  const stripeFailure = { eventType: "payment_intent.payment_failed", occurredAt: "2026-02-10T15:00:00.000Z", error: { code: "card_declined" } }

  it("reuses a pending prepared purchase that already carries a recorded decline", async () => {
    const { createOrReuseNativePreparedPurchase } = await import("@/lib/checkout/prepared-native-purchase-create")
    const existing = { ...(await storedPurchase()), metadata: { ...(await storedPurchase()).metadata, stripeFailure } }
    mockPurchaseFindUnique.mockResolvedValue(existing)

    await expect(createOrReuseNativePreparedPurchase(reuseInput)).resolves.toMatchObject({ id: "purchase_1" })
    expect(mockPurchaseCreate).not.toHaveBeenCalled()
  })

  it("reopens a declined (failed) prepared purchase as pending so the customer can retry the same attempt", async () => {
    const { createOrReuseNativePreparedPurchase } = await import("@/lib/checkout/prepared-native-purchase-create")
    const base = await storedPurchase()
    const failed = { ...base, status: "failed", metadata: { ...base.metadata, stripeFailure } }
    mockPurchaseFindUnique.mockResolvedValueOnce(failed).mockResolvedValueOnce({ ...failed, status: "pending" })
    mockPurchaseUpdateMany.mockResolvedValue({ count: 1 })

    await expect(createOrReuseNativePreparedPurchase(reuseInput)).resolves.toMatchObject({ id: "purchase_1", status: "pending" })
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith({ where: { id: "purchase_1", status: "failed" }, data: { status: "pending" } })
  })

  it("reopens a canceled prepared purchase as pending with a fresh PaymentIntent generation so the customer can retry", async () => {
    const { createOrReuseNativePreparedPurchase } = await import("@/lib/checkout/prepared-native-purchase-create")
    const base = await storedPurchase()
    const canceled = {
      ...base, status: "canceled", stripePaymentIntentId: "pi_canceled",
      metadata: { ...base.metadata, paymentAttempts: [{ at: "2026-02-10T15:00:00.000Z", channel: "native_m2", status: "canceled", paymentIntentId: "pi_canceled" }] },
    }
    const reopened = { ...canceled, status: "pending", stripePaymentIntentId: null, metadata: { ...canceled.metadata, paymentAttemptGeneration: "1" } }
    mockPurchaseFindUnique.mockResolvedValueOnce(canceled).mockResolvedValueOnce(reopened)
    mockPurchaseUpdateMany.mockResolvedValue({ count: 1 })

    await expect(createOrReuseNativePreparedPurchase(reuseInput)).resolves.toMatchObject({ id: "purchase_1", status: "pending" })
    expect(mockPurchaseUpdateMany).toHaveBeenCalledWith({
      where: { id: "purchase_1", status: "canceled", stripePaymentIntentId: "pi_canceled" },
      data: { status: "pending", stripePaymentIntentId: null, metadata: reopened.metadata },
    })
  })

  it("does not reopen a paid prepared purchase", async () => {
    const { createOrReuseNativePreparedPurchase } = await import("@/lib/checkout/prepared-native-purchase-create")
    mockPurchaseFindUnique.mockResolvedValue({ ...(await storedPurchase()), status: "paid" })

    await expect(createOrReuseNativePreparedPurchase(reuseInput)).rejects.toMatchObject({ code: "mismatch", status: 409 })
    expect(mockPurchaseUpdateMany).not.toHaveBeenCalled()
  })

  it.each([
    ["malformed", "invalid".repeat(8), "invalid_reference", 400, caller],
    ["duplicate", "A".repeat(43), "unavailable", 409, caller],
    ["stale", "B".repeat(43), "unavailable", 409, caller],
    ["foreign caller", "C".repeat(43), "unavailable", 409, { terminalId: "terminal_2", sessionId: "session_2" }],
  ])("fails closed for %s references", async (_case, reference, code, status, attemptCaller) => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    const { consumePreparedNativePurchase, PreparedNativePurchaseError } = await import("@/lib/stripe/prepared-native-purchase")

    await expect(consumePreparedNativePurchase(reference, attemptCaller)).rejects.toMatchObject({
      name: PreparedNativePurchaseError.name, message: "Prepared purchase is unavailable", code, status,
    })
    if (code === "invalid_reference") expect(mockTransaction).not.toHaveBeenCalled()
    else expect(mockUpdateMany.mock.calls[0]?.[0].where).toMatchObject(attemptCaller)
  })
})
