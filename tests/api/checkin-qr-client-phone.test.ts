import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks ───────────────────────────────────────────────────
const mockAuth = vi.fn()
const mockGetUser = vi.fn()
const mockUpsertUser = vi.fn()
const mockSessionUpsert = vi.fn()
const mockAttendanceFindUnique = vi.fn()
const mockAttendanceCreate = vi.fn()
const mockAttendanceUpdate = vi.fn()
const mockPurchaseFindMany = vi.fn()
const mockPackagePurchaseFindMany = vi.fn()
const mockPackagePurchaseFindUnique = vi.fn()
const mockPackagePurchaseFindFirst = vi.fn()
const mockCourseCatalogFindUnique = vi.fn()
const mockPackagePurchaseUpdate = vi.fn()
const mockPackagePurchaseUpdateMany = vi.fn()
const mockPackageUsageLedgerCreate = vi.fn()
const mockPackageUsageLedgerFindUnique = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCreate = vi.fn()
const mockTxExecuteRaw = vi.fn()
const mockAttendanceCount = vi.fn()
const mockTransaction = vi.fn()
const mockAwardPoints = vi.fn()
const mockGetMilestoneClasses = vi.fn()
const mockResolveConsecutiveOffer = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  clerkClient: () => Promise.resolve({ users: { getUser: mockGetUser } }),
}))

vi.mock("@/lib/class-schedule", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/class-schedule")>()),
  getCourseBySlug: (slug: string) => (slug === "salsa-night" ? { slug } : null),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    classSession: { upsert: (...args: unknown[]) => mockSessionUpsert(...args) },
    courseCatalog: { findUnique: (...args: unknown[]) => mockCourseCatalogFindUnique(...args) },
    attendance: {
      findUnique: (...args: unknown[]) => mockAttendanceFindUnique(...args),
      create: (...args: unknown[]) => mockAttendanceCreate(...args),
      update: (...args: unknown[]) => mockAttendanceUpdate(...args),
      count: (...args: unknown[]) => mockAttendanceCount(...args),
    },
    purchase: { findMany: (...args: unknown[]) => mockPurchaseFindMany(...args) },
    packagePurchase: {
      findMany: (...args: unknown[]) => mockPackagePurchaseFindMany(...args),
      findUnique: (...args: unknown[]) => mockPackagePurchaseFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPackagePurchaseFindFirst(...args),
      update: (...args: unknown[]) => mockPackagePurchaseUpdate(...args),
    },
    packageUsageLedger: { create: (...args: unknown[]) => mockPackageUsageLedgerCreate(...args) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: () => "test",
  consumeRateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}))

vi.mock("@/lib/points/service", () => ({
  awardPointsFromRule: (...args: unknown[]) => mockAwardPoints(...args),
  getAttendanceMilestoneClasses: () => mockGetMilestoneClasses(),
}))

vi.mock("@/lib/points/constants", () => ({
  POINTS_RULE_KEYS: { CONSECUTIVE_ATTENDANCE: "consecutive-attendance" },
}))

vi.mock("@/lib/checkin/consecutive-offer", () => ({
  resolveConsecutiveOffer: (...args: unknown[]) => mockResolveConsecutiveOffer(...args),
}))

const NOW = new Date("2026-06-11T19:00:00Z")

const buildRequest = (body: Record<string, unknown>) =>
  new Request("https://app.test/api/checkin/qr/client-phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const defaultBody = { courseSlug: "salsa-night", date: "2026-06-11", time: "20:00" }

const clerkUser = {
  primaryEmailAddress: { emailAddress: "ana@example.com" },
  primaryPhoneNumber: { phoneNumber: "+19175551212" },
  firstName: "Ana",
  lastName: "Diaz",
}

const dbUser = { id: "user_1" }

const session = { id: "session_1", courseSlug: "salsa-night", startsAt: new Date("2026-06-11T20:00:00"), title: "Salsa Night", durationMinutes: 60 }

const consecutiveOffer = {
  linkedCourseSlug: "bachata-night",
  linkedCourseTitle: "Bachata Night",
  linkedCourseTime: "21:10",
  dropInConsecutiveCents: 1500,
  packageHolderConsecutiveCents: 1000,
  discountPercent: 50,
}

function setupDefaults() {
  mockAuth.mockReturnValue({ userId: "clerk_1" })
  mockGetUser.mockResolvedValue(clerkUser)
  mockUpsertUser.mockResolvedValue(dbUser)
  mockSessionUpsert.mockResolvedValue(session)
  mockAttendanceFindUnique.mockResolvedValue(null)
  mockCourseCatalogFindUnique.mockResolvedValue({ title: "Salsa Night", active: true })
  mockPackagePurchaseFindFirst.mockResolvedValue(null)
  mockPackagePurchaseUpdateMany.mockResolvedValue({ count: 1 })
  mockPackageUsageLedgerFindUnique.mockResolvedValue(null)
  mockPackageUsageLedgerCreate.mockResolvedValue({ id: "ledger_1" })
  mockPackagePurchaseUpdate.mockResolvedValue({ id: "pkg_1", remainingCredits: 4 })
  mockPurchaseFindFirst.mockResolvedValue(null)
  mockPurchaseCreate.mockResolvedValue({ id: "purchase_pkg_1" })
  mockTxExecuteRaw.mockResolvedValue(1)
  mockPurchaseFindMany.mockResolvedValue([])
  mockPackagePurchaseFindMany.mockResolvedValue([])
  mockAttendanceCount.mockResolvedValue(1)
  mockGetMilestoneClasses.mockResolvedValue(5)
  mockAwardPoints.mockResolvedValue({ awarded: false, points: 0 })
  mockResolveConsecutiveOffer.mockResolvedValue(null)
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      attendance: {
        create: (...args: unknown[]) => mockAttendanceCreate(...args),
        update: (...args: unknown[]) => mockAttendanceUpdate(...args),
      },
      packagePurchase: {
        update: (...args: unknown[]) => mockPackagePurchaseUpdate(...args),
        updateMany: (...args: unknown[]) => mockPackagePurchaseUpdateMany(...args),
        findUnique: (...args: unknown[]) => mockPackagePurchaseFindUnique(...args),
        findFirst: (...args: unknown[]) => mockPackagePurchaseFindFirst(...args),
      },
      packageUsageLedger: {
        create: (...args: unknown[]) => mockPackageUsageLedgerCreate(...args),
        findUnique: (...args: unknown[]) => mockPackageUsageLedgerFindUnique(...args),
      },
      purchase: {
        findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
        create: (...args: unknown[]) => mockPurchaseCreate(...args),
      },
      $executeRaw: (...args: unknown[]) => mockTxExecuteRaw(...args),
    }
    return fn(tx)
  })
  mockAttendanceCreate.mockResolvedValue({ id: "att_default", status: "checked_in", checkedInAt: NOW, metadata: {} })
  mockAttendanceUpdate.mockResolvedValue({ id: "att_default", status: "checked_in", checkedInAt: NOW, metadata: {} })
  vi.useFakeTimers({ now: NOW })
}

describe("POST /api/checkin/qr/client-phone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue({ userId: null })
    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    expect(res.status).toBe(401)
  })

  it("returns checked_in for stripe-paid purchase", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      { id: "purchase_1", status: "paid", amount: 2000, courseSlug: "salsa-night", metadata: { date: "2026-06-11", paymentChannel: "card" } },
    ])
    mockAttendanceCreate.mockResolvedValue({
      id: "att_1", status: "checked_in", checkedInAt: NOW, metadata: {},
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.cashPending).toBeUndefined()
    expect(data.consecutiveOffer).toBeNull()
  })

  it("returns checked_in with cashPending and a resolved offer for cash purchase", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      { id: "purchase_2", status: "pending", amount: 2000, courseSlug: "salsa-night", metadata: { date: "2026-06-11", paymentChannel: "cash", settlementStatus: "pending" } },
    ])
    mockAttendanceCreate.mockResolvedValue({
      id: "att_2", status: "checked_in", checkedInAt: NOW, metadata: {},
    })
    mockResolveConsecutiveOffer.mockResolvedValue(consecutiveOffer)

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.cashPending).toBe(true)
    expect(data.cashAmount).toBe(20)
    expect(data.consecutiveOffer).toEqual(consecutiveOffer)
  })

  it("returns checked_in with package and a resolved consecutive offer for package holder", async () => {
    mockPackagePurchaseFindMany.mockResolvedValue([
      { id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", courseSlug: "salsa-night", isUnlimited: false, remainingCredits: 5, expiresAt: null, status: "active", packagePlan: null },
    ])
    const createdAttendance = { id: "att_3", status: "checked_in", checkedInAt: NOW, metadata: {} }
    mockAttendanceCreate.mockResolvedValue(createdAttendance)
    mockPackagePurchaseFindFirst.mockResolvedValue({
      id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", courseSlug: "salsa-night", isUnlimited: false, remainingCredits: 5, expiresAt: null, status: "active",
    })
    mockPackagePurchaseFindUnique.mockResolvedValue({
      id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", isUnlimited: false, remainingCredits: 4, status: "active",
    })
    mockResolveConsecutiveOffer.mockResolvedValue(consecutiveOffer)

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.package).toBeTruthy()
    expect(data.package.remainingCredits).toBe(4)
    expect(data.consecutiveOffer).toEqual(consecutiveOffer)
    expect(mockPackagePurchaseFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ courseSlug: null, packagePlanId: null }]),
      }),
    }))
    expect(mockPackagePurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ remainingCredits: { gt: 0 } }),
      data: { remainingCredits: { decrement: 1 }, lastUsedAt: NOW },
    }))
    expect(mockResolveConsecutiveOffer).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_1",
      linkedFromCourseSlug: "salsa-night",
      now: NOW,
    }))
  })

  it("accepts an active catalog course not present in the legacy course list", async () => {
    mockCourseCatalogFindUnique.mockResolvedValue({ title: "Production Course", active: true })
    mockSessionUpsert.mockResolvedValue({
      ...session,
      courseSlug: "production-course",
      title: null,
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest({
      courseSlug: " Production-Course ",
      date: "2026-06-11",
      time: "20:00",
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: "rejected" })
    expect(mockCourseCatalogFindUnique).toHaveBeenCalledWith({
      where: { slug: "production-course" },
      select: { title: true, active: true },
    })
    expect(mockCourseCatalogFindUnique).toHaveBeenCalledTimes(1)
  })

  it("rejects an unknown course before using an active unscoped package", async () => {
    const universalPackage = {
      id: "pkg_universal", packageId: "plan_universal", packageLabel: "Universal", courseSlug: null,
      packagePlanId: null, isUnlimited: true, remainingCredits: null, expiresAt: null, status: "active", packagePlan: null,
    }
    mockCourseCatalogFindUnique.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([universalPackage])
    mockPackagePurchaseFindFirst.mockResolvedValue(universalPackage)

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest({ courseSlug: "unknown-course", date: "2026-06-11", time: "03:17" }))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "Course not found" })
    expect(mockCourseCatalogFindUnique).toHaveBeenCalledWith({
      where: { slug: "unknown-course" },
      select: { title: true, active: true },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockUpsertUser).not.toHaveBeenCalled()
    expect(mockSessionUpsert).not.toHaveBeenCalled()
    expect(mockAttendanceFindUnique).not.toHaveBeenCalled()
    expect(mockPackagePurchaseFindMany).not.toHaveBeenCalled()
    expect(mockAttendanceCreate).not.toHaveBeenCalled()
    expect(mockPackagePurchaseUpdateMany).not.toHaveBeenCalled()
    expect(mockPackageUsageLedgerCreate).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockAwardPoints).not.toHaveBeenCalled()
  })

  it("rejects an inactive catalog course before resolving the user or session", async () => {
    mockCourseCatalogFindUnique.mockResolvedValue({ title: "Inactive Course", active: false })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest({
      courseSlug: "inactive-course",
      date: "2026-06-11",
      time: "20:00",
    }))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "Course not found" })
    expect(mockCourseCatalogFindUnique).toHaveBeenCalledWith({
      where: { slug: "inactive-course" },
      select: { title: true, active: true },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockUpsertUser).not.toHaveBeenCalled()
    expect(mockSessionUpsert).not.toHaveBeenCalled()
    expect(mockAttendanceFindUnique).not.toHaveBeenCalled()
    expect(mockPackagePurchaseFindMany).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("returns PACKAGE_NO_CREDITS when atomic package reservation loses the final credit", async () => {
    mockPackagePurchaseFindMany.mockResolvedValue([
      { id: "pkg_1", packageId: "plan_1", packageLabel: "Final credit", courseSlug: "salsa-night", isUnlimited: false, remainingCredits: 1, expiresAt: null, status: "active", packagePlan: null },
    ])
    mockPackagePurchaseFindFirst.mockResolvedValue({
      id: "pkg_1", packageId: "plan_1", packageLabel: "Final credit", courseSlug: "salsa-night", isUnlimited: false, remainingCredits: 1, expiresAt: null, status: "active",
    })
    mockPackagePurchaseUpdateMany.mockResolvedValue({ count: 0 })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "PACKAGE_NO_CREDITS" })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockResolveConsecutiveOffer).not.toHaveBeenCalled()
    expect(mockAttendanceCount).not.toHaveBeenCalled()
  })

  it("returns rejected when no purchase or package exists", async () => {
    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("rejected")
    expect(data.message).toContain("No booking")
  })

  it("returns already_checked_in when attendance exists", async () => {
    mockAttendanceFindUnique.mockResolvedValue({
      id: "att_existing", status: "checked_in", checkedInAt: NOW,
      packageUsage: null,
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("already_checked_in")
  })

  it("checks in a valid purchase far from class time in production", async () => {
    const origEnv = process.env.NODE_ENV
    try {
      // @ts-expect-error -- override for test
      process.env.NODE_ENV = "production"
      vi.useRealTimers()
      vi.useFakeTimers({ now: new Date("2026-06-11T10:00:00Z") }) // 10 hours before class

      // Re-import to pick up production env
      vi.resetModules()
      setupDefaults()
      mockPurchaseFindMany.mockResolvedValue([
        { id: "purchase_1", status: "paid", amount: 2000, courseSlug: "salsa-night", metadata: { date: "2026-06-11", paymentChannel: "card" } },
      ])
      const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
      const res = await POST(buildRequest(defaultBody))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe("checked_in")
    } finally {
      // @ts-expect-error -- restore
      process.env.NODE_ENV = origEnv
    }
  })
})
