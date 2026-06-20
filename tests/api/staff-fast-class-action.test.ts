import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockEnsureAttendancePackagePurchase = vi.fn()
const mockConsumeRateLimit = vi.fn(() => ({ ok: true }))
const mockFindConsecutiveLinkBetween = vi.fn()

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

vi.mock("@/lib/course-links", () => ({
  findConsecutiveLinkBetween: (...args: unknown[]) => mockFindConsecutiveLinkBetween(...args),
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
    mockFindConsecutiveLinkBetween.mockReset()
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
        metadata: expect.objectContaining({ paymentChannel: "cash", settlementStatus: "pending", purchaseSource: "kiosk" }),
      }),
    }))
  })

  it("consumes package credit for Fast Sign", async () => {
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
      purchaseSource: "kiosk",
    }))
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("does not duplicate attendance or charge when Fast Pay is repeated", async () => {
    mockTx.attendance.findUnique.mockResolvedValue({ id: "attendance_existing", status: "checked_in_no_package" })
    mockTx.attendance.update.mockResolvedValue({ id: "attendance_existing", status: "checked_in_no_package" })
    mockTx.purchase.findFirst.mockResolvedValue({ id: "purchase_existing", amount: 2000 })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_pay",
      attendanceId: "attendance_existing",
      purchaseId: "purchase_existing",
    })
    expect(mockTx.attendance.create).not.toHaveBeenCalled()
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("does not create a new balance when Fast Pay is repeated after the class was paid", async () => {
    mockTx.attendance.findUnique.mockResolvedValue({ id: "attendance_existing", status: "checked_in_no_package" })
    mockTx.attendance.update.mockResolvedValue({ id: "attendance_existing", status: "checked_in_no_package" })
    mockTx.purchase.findFirst.mockResolvedValue({ id: "purchase_paid", amount: 2000, status: "paid" })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      mode: "fast_pay",
      attendanceId: "attendance_existing",
      purchaseId: "purchase_paid",
    })
    expect(body.outstandingBalanceAddedCents).toBeUndefined()
    expect(mockTx.purchase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ status: "pending" }),
    }))
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("reuses existing attendance when Fast Sign is repeated for the same class", async () => {
    mockPrisma.packagePurchase.findMany.mockResolvedValue([{ id: "package_purchase_1", packageId: "pkg_10", packageLabel: "10 Classes", isUnlimited: false, remainingCredits: 4, status: "active" }])
    mockTx.attendance.findUnique.mockResolvedValue({ id: "attendance_existing", status: "checked_in" })
    mockTx.attendance.update.mockResolvedValue({ id: "attendance_existing", status: "checked_in" })
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({
      packagePurchase: { id: "package_purchase_1", packageId: "pkg_10" },
      usage: { id: "usage_existing", attendanceId: "attendance_existing", delta: -1 },
      consumed: true,
    })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_sign_in",
      attendanceId: "attendance_existing",
      packagePurchaseId: "package_purchase_1",
    })
    expect(mockTx.attendance.create).not.toHaveBeenCalled()
    expect(mockReservePackageCreditForAttendanceTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attendanceId: "attendance_existing",
      packagePurchaseId: "package_purchase_1",
    }))
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("creates promo attendance and pending cash purchase when staff accepts the offer", async () => {
    mockFindConsecutiveLinkBetween.mockResolvedValue({
      courseSlugA: "salsa-beginner",
      courseSlugB: "bachata-beginner",
      active: true,
    })
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      ...course,
      slug: "bachata-beginner",
      title: "Bachata Beginner",
      availableTimes: ["20:00"],
      dropInPriceCents: 1000,
    })
    mockTx.purchase.create.mockResolvedValue({ id: "promo_purchase_1", amount: 1000 })

    const res = await postFastAction({
      userId: "user_1",
      acceptConsecutive: true,
      promo: {
        linkedCourseSlug: "bachata-beginner",
        linkedFromCourseSlug: "salsa-beginner",
        priceCents: 1000,
      },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "promo_cash",
      attendanceId: "attendance_1",
      purchaseId: "promo_purchase_1",
      outstandingBalanceAddedCents: 1000,
    })
    expect(mockFindConsecutiveLinkBetween).toHaveBeenCalledWith("salsa-beginner", "bachata-beginner")
    expect(mockTx.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "checked_in_no_package",
        metadata: expect.objectContaining({ source: "staff_fast_action_promo" }),
      }),
    }))
    expect(mockTx.purchase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 1000,
        metadata: expect.objectContaining({ source: "staff_fast_action_promo", purchaseSource: "kiosk" }),
      }),
    }))
  })

  it("offers only a linked promotional class later today", async () => {
    mockPrisma.courseLink.findMany.mockResolvedValue([
      {
        courseSlugA: "salsa-beginner",
        courseSlugB: "earlier-linked",
        dropInConsecutiveCents: 1500,
        packageHolderConsecutiveCents: 1000,
        active: true,
      },
      {
        courseSlugA: "salsa-beginner",
        courseSlugB: "later-linked",
        dropInConsecutiveCents: 1500,
        packageHolderConsecutiveCents: 1000,
        active: true,
      },
    ])
    mockPrisma.courseCatalog.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === "earlier-linked") return { ...course, slug: "earlier-linked", title: "Earlier Linked", availableTimes: ["18:00"] }
      if (where.slug === "later-linked") return { ...course, slug: "later-linked", title: "Later Linked", availableTimes: ["20:00"] }
      return null
    })

    const res = await postFastAction({ userId: "user_1" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_pay",
      promoOffer: {
        linkedCourseSlug: "later-linked",
        linkedCourseTitle: "Later Linked",
        priceCents: 1500,
      },
    })
  })

  it("previews a later promo without mutating attendance or purchases", async () => {
    mockPrisma.courseLink.findMany.mockResolvedValue([{
      courseSlugA: "salsa-beginner",
      courseSlugB: "later-linked",
      dropInConsecutiveCents: 1500,
      packageHolderConsecutiveCents: 1000,
      active: true,
    }])
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      ...course,
      slug: "later-linked",
      title: "Later Linked",
      availableTimes: ["20:00"],
    })

    const res = await postFastAction({ userId: "user_1", previewOnly: true })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_pay",
      previewOnly: true,
      promoOffer: { linkedCourseSlug: "later-linked" },
    })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockTx.attendance.create).not.toHaveBeenCalled()
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("processes first class and accepted promo in one request", async () => {
    mockPrisma.courseLink.findMany.mockResolvedValue([{
      courseSlugA: "salsa-beginner",
      courseSlugB: "later-linked",
      dropInConsecutiveCents: 1500,
      packageHolderConsecutiveCents: 1000,
      active: true,
    }])
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      ...course,
      slug: "later-linked",
      title: "Later Linked",
      availableTimes: ["20:00"],
    })
    mockFindConsecutiveLinkBetween.mockResolvedValue({
      courseSlugA: "salsa-beginner",
      courseSlugB: "later-linked",
      active: true,
    })
    mockTx.purchase.create
      .mockResolvedValueOnce({ id: "purchase_1", amount: 2000, status: "pending" })
      .mockResolvedValueOnce({ id: "promo_purchase_1", amount: 1500, status: "pending" })

    const res = await postFastAction({ userId: "user_1", includeConsecutive: true })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "fast_pay",
      purchaseId: "purchase_1",
      promoResult: {
        mode: "promo_cash",
        purchaseId: "promo_purchase_1",
        outstandingBalanceAddedCents: 1500,
      },
    })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
    expect(mockTx.purchase.create).toHaveBeenCalledTimes(2)
  })

  it("does not duplicate promo attendance or charge when accepted promo is repeated", async () => {
    mockFindConsecutiveLinkBetween.mockResolvedValue({
      courseSlugA: "salsa-beginner",
      courseSlugB: "bachata-beginner",
      active: true,
    })
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      ...course,
      slug: "bachata-beginner",
      title: "Bachata Beginner",
      availableTimes: ["20:00"],
    })
    mockTx.attendance.findUnique.mockResolvedValue({ id: "promo_attendance_existing", status: "checked_in_no_package" })
    mockTx.purchase.findFirst.mockResolvedValue({ id: "promo_purchase_existing", amount: 1000 })

    const res = await postFastAction({
      userId: "user_1",
      acceptConsecutive: true,
      promo: {
        linkedCourseSlug: "bachata-beginner",
        linkedFromCourseSlug: "salsa-beginner",
        priceCents: 1000,
      },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      mode: "promo_cash",
      attendanceId: "promo_attendance_existing",
      purchaseId: "promo_purchase_existing",
      outstandingBalanceAddedCents: 1000,
    })
    expect(mockTx.attendance.create).not.toHaveBeenCalled()
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })

  it("does not create a new promo balance when accepted promo was already paid", async () => {
    mockFindConsecutiveLinkBetween.mockResolvedValue({
      courseSlugA: "salsa-beginner",
      courseSlugB: "bachata-beginner",
      active: true,
    })
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      ...course,
      slug: "bachata-beginner",
      title: "Bachata Beginner",
      availableTimes: ["20:00"],
    })
    mockTx.attendance.findUnique.mockResolvedValue({ id: "promo_attendance_existing", status: "checked_in_no_package" })
    mockTx.purchase.findFirst.mockResolvedValue({ id: "promo_purchase_paid", amount: 1000, status: "paid" })

    const res = await postFastAction({
      userId: "user_1",
      acceptConsecutive: true,
      promo: {
        linkedCourseSlug: "bachata-beginner",
        linkedFromCourseSlug: "salsa-beginner",
        priceCents: 1000,
      },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      mode: "promo_cash",
      attendanceId: "promo_attendance_existing",
      purchaseId: "promo_purchase_paid",
    })
    expect(body.outstandingBalanceAddedCents).toBeUndefined()
    expect(mockTx.purchase.create).not.toHaveBeenCalled()
  })
})
