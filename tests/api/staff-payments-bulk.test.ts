import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockSyncPackagePurchase = vi.fn()
const mockReservePackageCredit = vi.fn()

const mockPrisma = {
  purchase: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  courseCatalog: {
    findMany: vi.fn(),
  },
  classSession: {
    upsert: vi.fn(),
  },
  attendance: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchase(...args),
  reservePackageCreditForAttendance: (...args: unknown[]) => mockReservePackageCredit(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff payments bulk route", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockSyncPackagePurchase.mockReset()
    mockReservePackageCredit.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.purchase.update.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.purchase.update.mockResolvedValue({ id: "purchase_1" })
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_1" })
    mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    mockSyncPackagePurchase.mockResolvedValue(null)
    mockReservePackageCredit.mockResolvedValue(null)
  })

  it("creates and links attendance when cash purchase metadata has no attendanceId", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_cash_create_attendance_1",
        userId: "user_6",
        courseSlug: "salsa-evening",
        courseTitle: "Salsa Evening",
        packageId: "evening-pack",
        amount: 5000,
        status: "pending",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: {
          paymentChannel: "cash",
          date: "2026-03-10",
          time: "20:00",
          packageId: "evening-pack",
        },
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_created_1" })
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_2" })
    mockReservePackageCredit.mockResolvedValue({ id: "usage_2" })

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_cash_create_attendance_1"] }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.attendance.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(2)

    const relinkUpdateCall = mockPrisma.purchase.update.mock.calls[1]?.[0]
    expect(relinkUpdateCall.where).toEqual({ id: "purchase_cash_create_attendance_1" })
    expect(relinkUpdateCall.data.metadata).toMatchObject({
      settlementStatus: "paid",
      settlementUpdatedBy: "staff_1",
      attendanceId: "att_created_1",
    })

    expect(mockReservePackageCredit).toHaveBeenCalledTimes(1)
    expect(mockReservePackageCredit.mock.calls[0]?.[0]).toMatchObject({
      packagePurchaseId: "pkg_purchase_2",
      userId: "user_6",
      attendanceId: "att_created_1",
      reason: "PACKAGE_INITIAL_BOOKING",
    })

    const data = await res.json()
    expect(data.syncedPackageCount).toBe(1)
    expect(data.packageCreditReservedCount).toBe(1)
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
          attendanceId: "att_1",
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
    mockReservePackageCredit.mockResolvedValue({ id: "usage_1" })

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
    expect(mockReservePackageCredit).toHaveBeenCalledTimes(1)
    expect(mockReservePackageCredit.mock.calls[0]?.[0]).toMatchObject({
      packagePurchaseId: "pkg_purchase_1",
      userId: "user_1",
      attendanceId: "att_1",
      reason: "PACKAGE_INITIAL_BOOKING",
    })

    const data = await res.json()
    expect(data.syncedPackageCount).toBe(1)
    expect(data.packageCreditReservedCount).toBe(1)
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

  it("is idempotent when package credit was already reserved", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_cash_3",
        userId: "user_3",
        courseSlug: "salsa-evening",
        packageId: "evening-pack",
        status: "pending",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: { paymentChannel: "cash", attendanceId: "att_existing" },
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_existing" })
    mockReservePackageCredit.mockResolvedValue(null)

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_cash_3"] }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockReservePackageCredit).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.syncedPackageCount).toBe(1)
    expect(data.packageCreditReservedCount).toBe(0)
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

  it("treats paymentMethod cash metadata as cash purchase", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_cash_method",
        userId: "user_4",
        courseSlug: "bachata-beginners",
        packageId: null,
        status: "pending",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: { paymentMethod: "cash" },
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      },
    ])

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_cash_method"] }),
      })
    )

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBe("paid")
  })

  it("does not treat inconsistent stripe+cash metadata rows as cash", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_inconsistent_1",
        userId: "user_5",
        courseSlug: "bachata-beginners",
        packageId: null,
        status: "pending",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        metadata: { paymentMethod: "cash" },
        stripePaymentIntentId: "pi_999",
        stripeCheckoutSessionId: null,
      },
    ])

    const { POST } = await import("@/app/api/staff/payments/bulk/route")
    const res = await POST(
      new Request("http://localhost/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", ids: ["purchase_inconsistent_1"] }),
      })
    )

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBeUndefined()
    expect(updateCall.data.metadata).toMatchObject({ settlementStatus: "paid" })
  })
})
