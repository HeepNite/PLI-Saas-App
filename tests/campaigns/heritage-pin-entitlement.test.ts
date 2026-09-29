import { beforeEach, describe, expect, it, vi } from "vitest"

const tx = {
  $queryRaw: vi.fn(),
  purchase: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}
const mockPrisma = {
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

const intentMetadata = {
  paymentChannel: "card",
  heritagePinIntent: "latin-heritage-2026",
  heritagePinCountryCode: "MX",
  heritagePinSource: "public_booking",
}

describe("Heritage pin entitlement persistence", () => {
  beforeEach(() => {
    tx.$queryRaw.mockReset()
    tx.purchase.findMany.mockReset()
    tx.purchase.findFirst.mockReset()
    tx.purchase.update.mockReset()
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    tx.$queryRaw.mockResolvedValue([{ id: "user_1" }])
  })

  it("serializes by user and writes one pending entitlement onto the paid source purchase", async () => {
    tx.purchase.findMany.mockResolvedValue([])
    tx.purchase.findFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      status: "paid",
      metadata: intentMetadata,
      createdAt: new Date("2026-10-05T14:00:00.000Z"),
    })
    tx.purchase.update.mockImplementation(async ({ data }: { data: { metadata: unknown } }) => ({
      id: "purchase_1",
      userId: "user_1",
      metadata: data.metadata,
      createdAt: new Date("2026-10-05T14:00:00.000Z"),
    }))

    const { awardHeritagePinFromPaidPurchase } = await import("@/lib/campaigns/heritage-pin-entitlement")
    const result = await awardHeritagePinFromPaidPurchase({
      userId: "user_1",
      purchaseId: "purchase_1",
      metadata: intentMetadata,
      settledAt: new Date("2026-10-05T14:00:00.000Z"),
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.purchase.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { metadata: expect.objectContaining({ heritagePinStatus: "pending", heritagePinCountryCode: "MX" }) },
    }))
    expect(result).toMatchObject({ status: "pending", countryCode: "MX", sourcePurchaseId: "purchase_1" })
  })

  it("returns an existing entitlement without mutating a second purchase", async () => {
    tx.purchase.findMany.mockResolvedValue([{
      id: "purchase_existing",
      userId: "user_1",
      createdAt: new Date("2026-10-02T14:00:00.000Z"),
      metadata: {
        ...intentMetadata,
        heritagePinCampaign: "latin-heritage-2026",
        heritagePinStatus: "pending",
        heritagePinEarnedAt: "2026-10-02T14:00:00.000Z",
      },
    }])

    const { awardHeritagePinFromPaidPurchase } = await import("@/lib/campaigns/heritage-pin-entitlement")
    const result = await awardHeritagePinFromPaidPurchase({
      userId: "user_1",
      purchaseId: "purchase_2",
      metadata: intentMetadata,
      settledAt: new Date("2026-10-05T14:00:00.000Z"),
    })

    expect(result).toMatchObject({ sourcePurchaseId: "purchase_existing" })
    expect(tx.purchase.findFirst).not.toHaveBeenCalled()
    expect(tx.purchase.update).not.toHaveBeenCalled()
  })

  it("does nothing for an out-of-window or malformed intent", async () => {
    const { awardHeritagePinFromPaidPurchase } = await import("@/lib/campaigns/heritage-pin-entitlement")
    await expect(awardHeritagePinFromPaidPurchase({
      userId: "user_1",
      purchaseId: "purchase_1",
      metadata: { ...intentMetadata, heritagePinCountryCode: "ZZ" },
      settledAt: new Date("2026-10-05T14:00:00.000Z"),
    })).resolves.toBeNull()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
