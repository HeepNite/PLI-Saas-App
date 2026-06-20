import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockEnsureAttendancePackagePurchase = vi.fn()
const mockConsumeRateLimit = vi.fn(() => ({ ok: true }))

const mockTx = {
  classSession: { upsert: vi.fn() },
  attendance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  purchase: { findFirst: vi.fn(), create: vi.fn() },
}

const mockPrisma = {
  courseCatalog: { findMany: vi.fn(), findUnique: vi.fn() },
  packagePurchase: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  courseLink: { findMany: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperationalRequest(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff:students:fast-class-action"),
  consumeRateLimit: () => mockConsumeRateLimit(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCreditForAttendanceTx(...args),
}))

vi.mock("@/lib/purchase-attendance", () => ({
  ensureAttendancePackagePurchase: (...args: unknown[]) => mockEnsureAttendancePackagePurchase(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

const postFastAction = async (body: unknown) => {
  const { POST } = await import("@/app/api/staff/students/fast-class-action/route")
  return POST(new Request("http://localhost/api/staff/students/fast-class-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))
}

const course = {
  slug: "salsa-beginner",
  title: "Salsa Beginner",
  category: "salsa",
  level: "beginner",
  durationMinutes: 60,
  availableWeekdays: [5],
  availableTimes: ["19:00"],
  scheduleRules: null,
  dropInPriceCents: 2000,
  firstClassPriceCents: 1000,
  coverImageUrl: null,
}

describe("POST /api/staff/students/fast-class-action", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-19T23:30:00.000Z"))
    mockAuthorizeStudentOperationalRequest.mockReset().mockResolvedValue({ ok: true, userId: "staff_1", role: "staff", category: "front_desk", staffName: "Desk" })
    mockConsumeRateLimit.mockReset().mockReturnValue({ ok: true })
    mockPrisma.courseCatalog.findMany.mockReset().mockResolvedValue([course])
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset().mockResolvedValue([])
    mockPrisma.user.findUnique.mockReset().mockResolvedValue({ id: "user_1", email: "student@example.com", name: "Student", phone: "15551234567" })
    mockPrisma.courseLink.findMany.mockReset().mockResolvedValue([])
    mockPrisma.$transaction.mockReset().mockImplementation(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx))
    mockTx.classSession.upsert.mockReset().mockResolvedValue({ id: "session_1" })
    mockTx.attendance.findUnique.mockReset().mockResolvedValue(null)
    mockTx.attendance.create.mockReset().mockResolvedValue({ id: "attendance_1", status: "checked_in_no_package" })
    mockTx.attendance.update.mockReset()
    mockTx.purchase.findFirst.mockReset().mockResolvedValue(null)
    mockTx.purchase.create.mockReset().mockResolvedValue({ id: "purchase_1", amount: 2000 })
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockEnsureAttendancePackagePurchase.mockReset()
  })

  it("rejects unauthorized staff before mutating", async () => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("creates attendance and a pending cash purchase for Fast Pay", async () => {
    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_pay",
      attendanceId: "attendance_1",
      purchaseId: "purchase_1",
      outstandingBalanceAddedCents: 2000,
    })
    expect(mockTx.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "checked_in_no_package" }),
    }))
    expect(mockTx.purchase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 2000,
        status: "pending",
        metadata: expect.objectContaining({ paymentChannel: "cash", settlementStatus: "pending" }),
      }),
    }))
  })

  it("consumes package credit for Fast Sign-in", async () => {
    mockPrisma.packagePurchase.findMany.mockResolvedValue([{ id: "package_purchase_1", packageId: "pkg_10", packageLabel: "10 Classes", isUnlimited: false, remainingCredits: 4, status: "active" }])
    mockTx.attendance.create.mockResolvedValue({ id: "attendance_1", status: "checked_in" })
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({ packagePurchase: { id: "package_purchase_1", packageId: "pkg_10" } })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_sign_in",
      attendanceId: "attendance_1",
      packagePurchaseId: "package_purchase_1",
    })
    expect(mockReservePackageCreditForAttendanceTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      packagePurchaseId: "package_purchase_1",
      attendanceId: "attendance_1",
      reason: "STAFF_FAST_SIGN_IN",
    }))
    expect(mockEnsureAttendancePackagePurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attendanceId: "attendance_1",
      packagePurchaseId: "package_purchase_1",
      source: "staff_fast_sign_in",
    }))
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })
})
