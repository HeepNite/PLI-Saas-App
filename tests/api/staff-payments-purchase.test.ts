import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockSyncPackagePurchase = vi.fn()
const mockReservePackageCredit = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()

const mockPrisma = {
  purchase: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  classSession: {
    upsert: vi.fn(),
  },
  attendance: {
    upsert: vi.fn(),
  },
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

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

const PURCHASE_ID = "purchase_1"
const STAFF_USER_ID = "staff_1"

const makePatchRequest = (purchaseId: string, body: unknown) =>
  new Request(`http://localhost/api/staff/payments/${purchaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const makeContext = (purchaseId: string) => ({
  params: Promise.resolve({ purchaseId }),
})

describe("staff payments single purchase PATCH route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizePortal.mockReset()
    mockSyncPackagePurchase.mockReset()
    mockReservePackageCredit.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockPrisma.purchase.findUnique.mockReset()
    mockPrisma.purchase.update.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.upsert.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: STAFF_USER_ID, role: "admin" })
    mockPrisma.purchase.findUnique.mockResolvedValue(null)
    mockPrisma.purchase.update.mockResolvedValue({
      id: PURCHASE_ID,
      status: "paid",
      metadata: { settlementStatus: "paid", settlementUpdatedBy: STAFF_USER_ID },
    })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_1" })
    mockSyncPackagePurchase.mockResolvedValue(null)
    mockReservePackageCredit.mockResolvedValue(null)
  })

  it("returns 429 when rate limited", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 10 })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(429)
  })

  it("returns 401 when unauthorized", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(401)
  })

  it("returns 403 when user lacks required role", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid action", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      status: "pending",
      metadata: { paymentChannel: "cash" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      courseSlug: "salsa",
      courseTitle: "Salsa",
      packageId: null,
      createdAt: new Date(),
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "invalid_action" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid action/i)
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request(`http://localhost/api/staff/payments/${PURCHASE_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(req, makeContext(PURCHASE_ID))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid json/i)
  })

  it("returns 404 when purchase does not exist", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(null)

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toMatch(/purchase not found/i)
  })

  it("marks a cash purchase as paid and updates status", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: null,
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "cash", attendanceId: "att_existing" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.purchase.settlementStatus).toBe("paid")

    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.where).toEqual({ id: PURCHASE_ID })
    expect(updateCall.data.status).toBe("paid")
    expect(updateCall.data.metadata).toMatchObject({
      settlementStatus: "paid",
      settlementUpdatedBy: STAFF_USER_ID,
    })
  })

  it("marks a cash purchase as pending and clears settled status", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: null,
      status: "paid",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "cash", settlementStatus: "paid" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_pending" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBe("pending")
    expect(updateCall.data.metadata).toMatchObject({
      settlementStatus: "pending",
      settledAt: null,
      settlementUpdatedBy: STAFF_USER_ID,
    })
  })

  it("does not override status for card purchase, only updates settlement metadata", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      courseSlug: "zumba-morning",
      courseTitle: "Zumba Morning",
      packageId: null,
      status: "succeeded",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "card" },
      stripePaymentIntentId: "pi_123",
      stripeCheckoutSessionId: "cs_123",
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.status).toBeUndefined()
    expect(updateCall.data.metadata).toMatchObject({ settlementStatus: "paid" })
  })

  it("creates attendance record when cash purchase is marked paid and no attendanceId exists", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: null,
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: {
        paymentChannel: "cash",
        date: "2026-03-10",
        time: "20:00",
      },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_new_1" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.attendance.upsert).toHaveBeenCalledTimes(1)
    // First update: settlement, second update: link attendanceId
    expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(2)
    const relinkCall = mockPrisma.purchase.update.mock.calls[1]?.[0]
    expect(relinkCall.data.metadata).toMatchObject({ attendanceId: "att_new_1" })
  })

  it("skips attendance creation when attendanceId already exists on cash purchase", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_1",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: null,
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: {
        paymentChannel: "cash",
        attendanceId: "att_existing",
        date: "2026-03-10",
        time: "20:00",
      },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.update).toHaveBeenCalledTimes(1)
  })

  it("syncs package purchase and reserves credit when packageId exists", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_2",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: "evening-pack",
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: {
        paymentChannel: "cash",
        attendanceId: "att_existing",
        packageLabel: "Evening pack",
        packageTotalCredits: "12",
        packageIsUnlimited: "false",
        packageCadence: "3/week",
        packageMakeUps: "3",
        packageValidDays: "120",
      },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_1" })
    mockReservePackageCredit.mockResolvedValue({ id: "usage_1" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledTimes(1)
    expect(mockSyncPackagePurchase.mock.calls[0]?.[0]).toMatchObject({
      userId: "user_2",
      purchaseId: PURCHASE_ID,
      source: "cash",
    })
    expect(mockReservePackageCredit).toHaveBeenCalledTimes(1)
    expect(mockReservePackageCredit.mock.calls[0]?.[0]).toMatchObject({
      packagePurchaseId: "pkg_purchase_1",
      userId: "user_2",
      attendanceId: "att_existing",
      reason: "PACKAGE_INITIAL_BOOKING",
    })

    const data = await res.json()
    expect(data.purchase.packageSynced).toBe(true)
    expect(data.purchase.packageCreditReserved).toBe(true)
  })

  it("skips package sync when action is mark_pending", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_3",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: "evening-pack",
      status: "paid",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "cash", attendanceId: "att_existing" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_pending" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).not.toHaveBeenCalled()
    expect(mockReservePackageCredit).not.toHaveBeenCalled()
  })

  it("persists a settlement note in metadata", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_4",
      courseSlug: "salsa-evening",
      courseTitle: "Salsa Evening",
      packageId: null,
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "cash" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(
      makePatchRequest(PURCHASE_ID, { action: "mark_paid", note: "Paid in full at front desk" }),
      makeContext(PURCHASE_ID)
    )

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.purchase.update.mock.calls[0]?.[0]
    expect(updateCall.data.metadata).toMatchObject({ settlementNote: "Paid in full at front desk" })
  })

  it("skips sentinel course slug attendance creation", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "user_5",
      courseSlug: "_staff_registration",
      courseTitle: null,
      packageId: null,
      status: "pending",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      metadata: { paymentChannel: "cash", date: "2026-03-10", time: "20:00" },
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(makePatchRequest(PURCHASE_ID, { action: "mark_paid" }), makeContext(PURCHASE_ID))

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.upsert).not.toHaveBeenCalled()
  })
})
