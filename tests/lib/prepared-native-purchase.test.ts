import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

const mockCreate = vi.fn()
const mockUpdateMany = vi.fn()
const mockFindUnique = vi.fn()
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
    preparedNativePurchase: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}))

const caller = { terminalId: "terminal_1", sessionId: "session_1" }
const now = new Date("2026-10-04T17:00:00.000Z")

describe("prepared native purchase capability", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    mockCreate.mockReset()
    mockUpdateMany.mockReset()
    mockFindUnique.mockReset()
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
