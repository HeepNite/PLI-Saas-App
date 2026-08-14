import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockSessionUpsert = vi.fn()
const mockAttendanceUpsert = vi.fn()
const mockAttendanceFindUnique = vi.fn()
const mockUserFindUnique = vi.fn()
const mockSyncPackagePurchase = vi.fn()
const mockReservePackageCredit = vi.fn()
const mockEnsureAttendancePackagePurchase = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  purchase: {
    findUnique: (...args: unknown[]) => mockFindUnique(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  classSession: {
    upsert: (...args: unknown[]) => mockSessionUpsert(...args),
  },
  attendance: {
    upsert: (...args: unknown[]) => mockAttendanceUpsert(...args),
    findUnique: (...args: unknown[]) => mockAttendanceFindUnique(...args),
  },
  user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  packagePlan: {
    findUnique: (...args: unknown[]) => mockFindUnique(...args),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortalSection(...args),
}))
vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-payments-patch-test"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))
vi.mock("@/lib/class-schedule", () => ({
  buildSessionStartsAt: vi.fn(() => new Date("2026-05-07T02:00:00.000Z")),
}))
vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mockSyncPackagePurchase(...args),
  reservePackageCreditForAttendance: (...args: unknown[]) => mockReservePackageCredit(...args),
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCredit(...args),
}))
vi.mock("@/lib/purchase-attendance", () => ({
  ensureAttendancePackagePurchase: (...args: unknown[]) => mockEnsureAttendancePackagePurchase(...args),
}))
vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

describe("staff payment settlement route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizePortalSection.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockSessionUpsert.mockReset()
    mockAttendanceUpsert.mockReset()
    mockAttendanceFindUnique.mockReset()
    mockUserFindUnique.mockReset()
    mockSyncPackagePurchase.mockReset()
    mockReservePackageCredit.mockReset()
    mockEnsureAttendancePackagePurchase.mockReset()
    mockWriteAudit.mockReset()
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma))

    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockFindUnique.mockResolvedValue({
      id: "purchase_main",
      userId: "user_1",
      status: "pending",
      courseSlug: "salsa-timba-in-new-york",
      courseTitle: "Salsa timba in New York",
      packageId: "first-groove",
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      createdAt: new Date("2026-05-06T19:19:24.564Z"),
      metadata: {
        paymentChannel: "cash",
        source: "tablet",
        date: "2026-05-06",
        time: "22:00",
        courseSlug: "salsa-timba-in-new-york",
        packageId: "first-groove",
        packageLabel: "ONCE PER WEEK",
        packageTotalCredits: "5",
        packageIsUnlimited: "false",
      },
    })
    mockUpdate
      .mockResolvedValueOnce({ id: "purchase_main", status: "paid", metadata: { paymentChannel: "cash" } })
      .mockResolvedValueOnce({ id: "purchase_main", status: "paid", metadata: { paymentChannel: "cash", attendanceId: "att_main" } })
    mockSessionUpsert.mockResolvedValue({ id: "session_1" })
    mockAttendanceUpsert.mockResolvedValue({ id: "att_main" })
    mockAttendanceFindUnique.mockResolvedValue({
      id: "att_created",
      session: { courseSlug: "salsa", title: "Salsa", startsAt: new Date("2026-05-07T02:00:00.000Z") },
    })
    mockUserFindUnique.mockResolvedValue({ email: "student@example.com", name: "Student", phone: "+15550100" })
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_1" })
    mockReservePackageCredit.mockResolvedValue({ consumed: true })
  })

  it("preserves attendance and initial credit reservation for tablet cash package purchases", async () => {
    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payments/purchase_main", {
        method: "PATCH",
        body: JSON.stringify({ action: "mark_paid" }),
      }),
      { params: Promise.resolve({ purchaseId: "purchase_main" }) }
    )

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledTimes(1)
    expect(mockReservePackageCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        packagePurchaseId: "pkg_purchase_1",
        attendanceId: "att_main",
        courseSlug: "salsa-timba-in-new-york",
        reason: "PACKAGE_INITIAL_BOOKING",
      })
    )
    expect(data.purchase).toMatchObject({
      packageSynced: true,
      packageCreditReserved: true,
    })
  })

  it("materializes a staff package grant atomically from current plan values without attendance or credit reservation", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: "purchase_grant",
        userId: "user_1",
        status: "pending",
        courseSlug: "package:legacy-key",
        packageId: "legacy-key",
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
        createdAt: new Date("2026-05-06T19:19:24.564Z"),
        metadata: { paymentChannel: "cash", source: "staff_package_grant", packagePlanId: "plan_1" },
      })
      .mockResolvedValueOnce({ id: "plan_1", key: "current-key", label: "Current plan", courseSlug: "salsa", totalCredits: 12, isUnlimited: false, cadence: "monthly", makeUps: 2, validDays: 90 })
    mockUpdate.mockResolvedValue({ id: "purchase_grant", status: "paid", metadata: {} })
    mockSyncPackagePurchase.mockResolvedValue({ id: "package_purchase_1" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payments/purchase_grant", { method: "PATCH", body: JSON.stringify({ action: "mark_paid" }) }),
      { params: Promise.resolve({ purchaseId: "purchase_grant" }) }
    )

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledWith(expect.objectContaining({ tx: mockPrisma, packagePlanId: "plan_1", metadata: expect.objectContaining({ packageId: "current-key", packageTotalCredits: "12", packageValidDays: "90" }) }))
    expect(mockWriteAudit).toHaveBeenCalledWith(expect.objectContaining({ field: "cash_package_grant_settlement", valueAfter: expect.objectContaining({ outcome: "SETTLED" }) }), mockPrisma)
    expect(mockSessionUpsert).not.toHaveBeenCalled()
    expect(mockAttendanceUpsert).not.toHaveBeenCalled()
    expect(mockReservePackageCredit).not.toHaveBeenCalled()
    expect(mockEnsureAttendancePackagePurchase).not.toHaveBeenCalled()
  })

  it("settles a creation-time cash package with one linked attendance credit and package-credit purchase", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: "purchase_created", userId: "user_1", status: "pending", courseSlug: "package:legacy-key", courseTitle: "Legacy plan",
        packageId: "legacy-key", email: "student@example.com", name: "Student", phone: "+15550100",
        stripePaymentIntentId: null, stripeCheckoutSessionId: null, createdAt: new Date("2026-05-06T19:19:24.564Z"),
        metadata: { paymentChannel: "cash", source: "staff_created_student_cash_package", packagePlanId: "plan_1", attendanceId: "att_created" },
      })
      .mockResolvedValueOnce({ id: "plan_1", key: "current-key", label: "Current plan", courseSlug: "salsa", totalCredits: 12, isUnlimited: false, cadence: "monthly", makeUps: 2, validDays: 90 })
    mockUpdate.mockReset()
    mockUpdate.mockResolvedValue({ id: "purchase_created", status: "paid", metadata: {} })
    mockSyncPackagePurchase.mockResolvedValue({ id: "package_purchase_1", packageId: "current-key" })
    mockReservePackageCredit.mockResolvedValue({ consumed: true })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payments/purchase_created", { method: "PATCH", body: JSON.stringify({ action: "mark_paid", note: "Cash received" }) }),
      { params: Promise.resolve({ purchaseId: "purchase_created" }) }
    )

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledWith(expect.objectContaining({ tx: mockPrisma, packagePlanId: "plan_1" }))
    expect(mockReservePackageCredit).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({
      packagePurchaseId: "package_purchase_1", attendanceId: "att_created", reason: "PACKAGE_INITIAL_BOOKING",
    }))
    expect(mockEnsureAttendancePackagePurchase).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({
      attendanceId: "att_created", packageId: "current-key", packagePurchaseId: "package_purchase_1",
    }))
    expect(mockWriteAudit).toHaveBeenCalledWith(expect.objectContaining({ field: "cash_package_creation_settlement", reason: "Cash received" }), mockPrisma)
    expect(await res.json()).toMatchObject({ purchase: { packageSynced: true, packageCreditReserved: true } })
  })

  it("skips credit reservation and attendance materialization when a creation cash package has no linked attendance", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: "purchase_created", userId: "user_1", status: "pending", courseSlug: "package:legacy-key", courseTitle: "Legacy plan",
        packageId: "legacy-key", email: null, name: null, phone: null, stripePaymentIntentId: null, stripeCheckoutSessionId: null,
        createdAt: new Date("2026-05-06T19:19:24.564Z"),
        metadata: { paymentChannel: "cash", source: "staff_created_student_cash_package", packagePlanId: "plan_1" },
      })
      .mockResolvedValueOnce({ id: "plan_1", key: "current-key", label: "Current plan", courseSlug: "salsa", totalCredits: 12, isUnlimited: false, cadence: "monthly", makeUps: 2, validDays: 90 })
    mockUpdate.mockReset()
    mockUpdate.mockResolvedValue({ id: "purchase_created", status: "paid", metadata: {} })
    mockSyncPackagePurchase.mockResolvedValue({ id: "package_purchase_1", packageId: "current-key" })

    const { PATCH } = await import("@/app/api/staff/payments/[purchaseId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payments/purchase_created", { method: "PATCH", body: JSON.stringify({ action: "mark_paid" }) }),
      { params: Promise.resolve({ purchaseId: "purchase_created" }) }
    )

    expect(res.status).toBe(200)
    expect(mockSyncPackagePurchase).toHaveBeenCalledTimes(1)
    expect(mockReservePackageCredit).not.toHaveBeenCalled()
    expect(mockEnsureAttendancePackagePurchase).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ purchase: { packageSynced: true, packageCreditReserved: false } })
  })
})
