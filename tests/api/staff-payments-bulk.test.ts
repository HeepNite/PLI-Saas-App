import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockSyncPackagePurchase = vi.fn()

const mockPrisma = {
  purchase: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchase(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff payments bulk route", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockSyncPackagePurchase.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.purchase.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.purchase.update.mockResolvedValue({ id: "purchase_1" })
    mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    mockSyncPackagePurchase.mockResolvedValue(null)
  })

  it("marks cash purchases as paid and syncs package purchases", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_cash_1",
        userId: "user_1",
        courseSlug: "salsa-evening",
        packageId: "evening-pack",
        status: "pending",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: {
          paymentChannel: "cash",
          packageLabel: "Evening pack",
          packageTotalCredits: "12",
          packageIsUnlimited: "false",
          packageCadence: "3/week",
          packageMakeUps: "3",
          packageValidDays: "120",
        },
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_1" })

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_cash_1"] }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(1)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.where).toEqual({ id: "purchase_cash_1" })
    expect(updateCall.data.status).toBe("paid")
    expect(updateCall.data.metadata).toMatchObject({
      settlementStatus: "paid",
      settlementUpdatedBy: "staff_1",
    })
    expect(mockSyncPackagePurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncPackagePurchase.mock.calls[0]?.[0]).toMatchObject({
      userId: "user_1",
      purchaseId: "purchase_cash_1",
      source: "cash",
      metadata: { packageId: "evening-pack" },
    })

    const data = await res.json()
    expect(data.syncedPackageCount).toBe(1)
  })

  it("marks cash purchases as pending without syncing packages", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_cash_2",
        userId: "user_2",
        courseSlug: "salsa-evening",
        packageId: "evening-pack",
        status: "paid",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: { paymentChannel: "cash" },
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_pending", ids: ["purchase_cash_2"] }),
      })
    )

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBe("pending")
    expect(updateCall.data.metadata).toMatchObject({
      settlementStatus: "pending",
      settledAt: null,
      settlementUpdatedBy: "staff_1",
    })
    expect(mockSyncPackagePurchase).not.toHaveBeenCalled()
  })

  it("does not override card purchase status when only settlement metadata is changed", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_card_1",
        userId: "user_3",
        courseSlug: "zumba-morning",
        packageId: null,
        status: "succeeded",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: { paymentChannel: "card" },
        stripePaymentIntentId: "pi_123",
        stripeCheckoutSessionId: "cs_123",
      },
    ])

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_card_1"] }),
      })
    )

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBeUndefined()
    expect(updateCall.data.metadata).toMatchObject({
      settlementStatus: "paid",
    })
  })
})
