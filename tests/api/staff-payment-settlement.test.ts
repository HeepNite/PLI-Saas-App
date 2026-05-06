import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockSessionUpsert = vi.fn()
const mockAttendanceUpsert = vi.fn()
const mockSyncPackagePurchase = vi.fn()
const mockReservePackageCredit = vi.fn()

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
  },
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
}))

describe("staff payment settlement route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizePortalSection.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockSessionUpsert.mockReset()
    mockAttendanceUpsert.mockReset()
    mockSyncPackagePurchase.mockReset()
    mockReservePackageCredit.mockReset()

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
    mockSyncPackagePurchase.mockResolvedValue({ id: "pkg_purchase_1" })
    mockReservePackageCredit.mockResolvedValue({ consumed: true })
  })

  it("reserves one package credit when cash package purchase is marked paid", async () => {
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
})
