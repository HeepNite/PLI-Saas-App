import { beforeEach, describe, expect, it, vi } from "vitest"

// Spec D4 (owner, 2026-10-23): verify items are resolved MANUALLY by staff only.
// "Collected" settles the attempt at the desk through the existing cash-settlement path;
// "Dismiss" closes it as not owed with a required reason. Both are audited.

const mockAuthorizePortal = vi.fn()
const mockSyncPackagePurchase = vi.fn()
const mockReservePackageCredit = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  purchase: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  classSession: { upsert: vi.fn() },
  attendance: { upsert: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))
vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchase(...args),
  reservePackageCreditForAttendance: (...args: unknown[]) => mockReservePackageCredit(...args),
  reservePackageCreditForAttendanceTx: vi.fn(),
}))
vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: () => "rate-limit-key",
  getClientIp: () => "127.0.0.1",
}))

const PURCHASE_ID = "purchase_verify"
const STAFF_USER_ID = "staff_1"
const UPDATED_AT = new Date("2026-10-23T15:00:00.000Z")

const declinedCard = (metadata: Record<string, unknown> = {}) => ({
  id: PURCHASE_ID,
  userId: "user_1",
  status: "failed",
  amount: 2500,
  currency: "usd",
  courseSlug: "salsa",
  courseTitle: "Salsa",
  packageId: null,
  createdAt: new Date("2026-10-23T14:00:00.000Z"),
  updatedAt: UPDATED_AT,
  stripePaymentIntentId: "pi_declined",
  stripeCheckoutSessionId: null,
  metadata: {
    paymentChannel: "card",
    settlementStatus: "pending",
    date: "2026-10-23",
    time: "18:00",
    stripeFailure: { eventType: "payment_intent.payment_failed", occurredAt: "2026-10-23T14:00:00.000Z", error: { code: "card_declined" } },
    ...metadata,
  },
})

const patch = async (body: unknown) => {
  const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
  return PATCH(
    new Request(`http://localhost/api/staff/payments/${PURCHASE_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ purchaseId: PURCHASE_ID }) },
  )
}

const lastClaimData = () => mockPrisma.purchase.updateMany.mock.calls.at(-1)?.[0]?.data as {
  status?: string
  metadata: Record<string, unknown>
}

describe("staff payments PATCH — manual verify resolution", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-23T16:00:00.000Z"))
    for (const mock of [mockAuthorizePortal, mockSyncPackagePurchase, mockReservePackageCredit, mockConsumeRateLimit, mockWriteAudit]) mock.mockReset()
    mockPrisma.purchase.findUnique.mockReset()
    mockPrisma.purchase.update.mockReset()
    mockPrisma.purchase.updateMany.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.$transaction.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: STAFF_USER_ID, role: "staff", category: null, subCategory: null, staffName: "Elvira" })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.purchase.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.purchase.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: PURCHASE_ID, status: "paid", ...data }))
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_1" })
    mockSyncPackagePurchase.mockResolvedValue(null)
    mockWriteAudit.mockResolvedValue(undefined)
  })

  it("is gated like other payment edits: unauthorized and forbidden staff cannot resolve", async () => {
    mockAuthorizePortal.mockResolvedValueOnce({ ok: false, status: 401, error: "Unauthorized" })
    expect((await patch({ action: "verify_collected" })).status).toBe(401)
    mockAuthorizePortal.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden" })
    expect((await patch({ action: "verify_dismissed", reason: "Class not taken" })).status).toBe(403)
    expect(mockPrisma.purchase.updateMany).not.toHaveBeenCalled()
    expect(mockAuthorizePortal).toHaveBeenCalledWith("students")
  })

  it.each([
    ["pending cash", { ...declinedCard(), status: "pending", stripePaymentIntentId: null, metadata: { paymentChannel: "cash", settlementStatus: "pending" } }],
    ["a paid card", { ...declinedCard(), status: "paid", metadata: { paymentChannel: "card", settlementStatus: "paid" } }],
  ])("rejects resolving %s, which is not in Verify", async (_label, purchase) => {
    mockPrisma.purchase.findUnique.mockResolvedValue(purchase)
    const res = await patch({ action: "verify_collected" })
    expect(res.status).toBe(409)
    expect(mockPrisma.purchase.updateMany).not.toHaveBeenCalled()
    expect(mockWriteAudit).not.toHaveBeenCalled()
  })

  it("collects a verify attempt at the desk through the cash-settlement path, with resolution and audit", async () => {
    mockPrisma.purchase.findUnique
      .mockResolvedValueOnce(declinedCard())
      .mockImplementationOnce(async () => ({ ...declinedCard(), status: "paid", metadata: lastClaimData().metadata }))

    const res = await patch({ action: "verify_collected", reason: "Paid cash at desk" })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PURCHASE_ID, updatedAt: UPDATED_AT },
    }))
    const claim = lastClaimData()
    expect(claim.status).toBe("paid")
    expect(claim.metadata).toMatchObject({
      paymentChannel: "cash",
      settlementStatus: "paid",
      settlementUpdatedBy: STAFF_USER_ID,
      stripeFailure: expect.objectContaining({ eventType: "payment_intent.payment_failed" }),
      verifyResolution: { action: "collected", by: STAFF_USER_ID, byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: "Paid cash at desk", previousPaymentChannel: "card" },
    })
    // Same side effects as a cash settlement: attendance for the class slot is created and linked.
    expect(mockPrisma.attendance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: "user_1", metadata: expect.objectContaining({ source: "cash_settlement", purchaseId: PURCHASE_ID }) }),
    }))
    expect(mockWriteAudit).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: "user_1", staffClerkId: STAFF_USER_ID, entity: "payment", entityId: PURCHASE_ID, field: "verify_resolution",
      valueAfter: expect.objectContaining({ action: "collected" }), reason: "Paid cash at desk",
    }), mockPrisma)
    expect(data).toMatchObject({ ok: true, purchase: { id: PURCHASE_ID, settlementStatus: "paid", paymentStatus: "paid", verifyResolution: { action: "collected" } } })
  })

  it("syncs a package bought by a verify card attempt when it is collected, like a cash package settlement", async () => {
    const packageAttempt = { ...declinedCard({ packageId: "pkg_4", packageLabel: "4 classes", packageTotalCredits: "4" }), packageId: "pkg_4" }
    mockPrisma.purchase.findUnique
      .mockResolvedValueOnce(packageAttempt)
      .mockImplementationOnce(async () => ({ ...packageAttempt, status: "paid", metadata: lastClaimData().metadata }))
    mockSyncPackagePurchase.mockResolvedValue({ id: "pp_1" })

    const res = await patch({ action: "verify_collected" })

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: PURCHASE_ID, source: "cash", metadata: expect.objectContaining({ packageId: "pkg_4" }) }))
    expect(mockReservePackageCredit).toHaveBeenCalledWith(expect.objectContaining({ packagePurchaseId: "pp_1", attendanceId: "att_1" }))
  })

  it("requires a reason to dismiss", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(declinedCard())
    for (const reason of [undefined, "", "   "]) {
      const res = await patch({ action: "verify_dismissed", reason })
      expect(res.status).toBe(400)
    }
    expect(mockPrisma.purchase.updateMany).not.toHaveBeenCalled()
  })

  it("dismisses a verify attempt as not owed, keeping its status and recording the resolution and audit", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(declinedCard())

    const res = await patch({ action: "verify_dismissed", reason: "  Class not taken  " })
    const data = await res.json()

    expect(res.status).toBe(200)
    const claim = lastClaimData()
    expect(claim.status).toBeUndefined()
    expect(claim.metadata).toMatchObject({
      paymentChannel: "card",
      settlementStatus: "pending",
      verifyResolution: { action: "dismissed", by: STAFF_USER_ID, byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: "Class not taken" },
    })
    expect(mockPrisma.attendance.upsert).not.toHaveBeenCalled()
    expect(mockSyncPackagePurchase).not.toHaveBeenCalled()
    expect(mockWriteAudit).toHaveBeenCalledWith(expect.objectContaining({
      entity: "payment", field: "verify_resolution", valueAfter: expect.objectContaining({ action: "dismissed" }), reason: "Class not taken",
    }), mockPrisma)
    expect(data).toMatchObject({ ok: true, purchase: { id: PURCHASE_ID, paymentStatus: "failed", verifyResolution: { action: "dismissed", reason: "Class not taken" } } })

    const { isVerifyCardAttempt } = await import("@/app/api/staff/payments/shared")
    expect(isVerifyCardAttempt({ ...declinedCard(), metadata: claim.metadata })).toBe(false)
  })

  it("is idempotent: repeating the same resolution writes nothing and returns the recorded one", async () => {
    const resolution = { action: "dismissed", by: "staff_2", byName: "Danna", at: "2026-10-23T15:30:00.000Z", reason: "Class not taken" }
    mockPrisma.purchase.findUnique.mockResolvedValue(declinedCard({ verifyResolution: resolution }))

    const res = await patch({ action: "verify_dismissed", reason: "Another reason" })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({ ok: true, idempotent: true, purchase: { verifyResolution: resolution } })
    expect(mockPrisma.purchase.updateMany).not.toHaveBeenCalled()
    expect(mockWriteAudit).not.toHaveBeenCalled()
  })

  it("refuses a different resolution once one is recorded", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(declinedCard({
      verifyResolution: { action: "dismissed", by: "staff_2", byName: "Danna", at: "2026-10-23T15:30:00.000Z", reason: "Class not taken" },
    }))
    expect((await patch({ action: "verify_collected" })).status).toBe(409)
    expect(mockPrisma.purchase.updateMany).not.toHaveBeenCalled()
  })

  it("returns 409 without side effects when the purchase changed concurrently", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(declinedCard())
    mockPrisma.purchase.updateMany.mockResolvedValue({ count: 0 })

    const res = await patch({ action: "verify_collected" })

    expect(res.status).toBe(409)
    expect(mockPrisma.attendance.upsert).not.toHaveBeenCalled()
    expect(mockWriteAudit).not.toHaveBeenCalled()
  })
})
