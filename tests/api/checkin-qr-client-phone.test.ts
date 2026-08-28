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
const mockCourseCatalogFindMany = vi.fn()
const mockCourseLinkFindMany = vi.fn()
const mockSpecialClassFindUnique = vi.fn()
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

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  clerkClient: () => Promise.resolve({ users: { getUser: mockGetUser } }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    classSession: { upsert: (...args: unknown[]) => mockSessionUpsert(...args) },
    courseCatalog: {
      findUnique: (...args: unknown[]) => mockCourseCatalogFindUnique(...args),
      findMany: (...args: unknown[]) => mockCourseCatalogFindMany(...args),
    },
    courseLink: { findMany: (...args: unknown[]) => mockCourseLinkFindMany(...args) },
    specialClass: { findUnique: (...args: unknown[]) => mockSpecialClassFindUnique(...args) },
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

function setupDefaults() {
  mockAuth.mockReturnValue({ userId: "clerk_1" })
  mockGetUser.mockResolvedValue(clerkUser)
  mockUpsertUser.mockResolvedValue(dbUser)
  mockSessionUpsert.mockResolvedValue(session)
  mockAttendanceFindUnique.mockResolvedValue(null)
  mockCourseCatalogFindUnique.mockResolvedValue(null)
  mockCourseCatalogFindMany.mockResolvedValue([])
  mockCourseLinkFindMany.mockResolvedValue([])
  mockSpecialClassFindUnique.mockResolvedValue(null)
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
  // Default $transaction executes the callback with a tx stub so routes that
  // create/update attendance inside a transaction resolve. Tests that need
  // specific transaction data override mockTransaction.
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
    vi.restoreAllMocks()
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
  })

  it("returns checked_in with cashPending for cash purchase", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      { id: "purchase_2", status: "pending", amount: 2000, courseSlug: "salsa-night", metadata: { date: "2026-06-11", paymentChannel: "cash", settlementStatus: "pending" } },
    ])
    mockAttendanceCreate.mockResolvedValue({
      id: "att_2", status: "checked_in", checkedInAt: NOW, metadata: {},
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.cashPending).toBe(true)
    expect(data.cashAmount).toBe(20)
  })

  it("returns checked_in with package for package holder", async () => {
    mockPackagePurchaseFindMany.mockResolvedValue([
      { id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", courseSlug: "salsa-night", isUnlimited: false, remainingCredits: 5, expiresAt: null, status: "active", packagePlan: null },
    ])
    const createdAttendance = { id: "att_3", status: "checked_in", checkedInAt: NOW, metadata: {} }
    mockAttendanceCreate.mockResolvedValue(createdAttendance)
    // A usable package is selected inside the reservation transaction.
    mockPackagePurchaseFindFirst.mockResolvedValue({
      id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", isUnlimited: false, remainingCredits: 5, status: "active",
    })
    mockPackagePurchaseUpdateMany.mockResolvedValue({ count: 1 })
    mockPackagePurchaseFindUnique.mockResolvedValue({
      id: "pkg_1", packageId: "plan_1", packageLabel: "Salsa 8-pack", isUnlimited: false, remainingCredits: 4, status: "active",
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.package).toBeTruthy()
    expect(data.package.remainingCredits).toBe(4)
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

  it("checks in a special-class purchase without metadata.date when it belongs to the resolved session", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      {
        id: "special_purchase_1",
        status: "capture_pending",
        amount: 2500,
        courseSlug: "salsa-night",
        specialClassId: "special_class_1",
        classSessionId: session.id,
        metadata: {},
      },
    ])
    mockSpecialClassFindUnique.mockResolvedValue({ id: "special_class_1", status: "published", classSessionId: session.id })
    mockAttendanceUpdate.mockResolvedValue({ id: "att_scheduled", status: "checked_in", checkedInAt: NOW, metadata: {} })
    mockAttendanceFindUnique.mockResolvedValue({ id: "att_scheduled", status: "scheduled", checkedInAt: session.startsAt, packageUsage: null })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(mockAttendanceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "att_scheduled" },
      data: expect.objectContaining({ status: "checked_in" }),
    }))
  })

  it("checks in a cash_pending special-class purchase", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      {
        id: "special_purchase_cash",
        status: "cash_pending",
        amount: 2500,
        courseSlug: "salsa-night",
        specialClassId: "special_class_1",
        classSessionId: session.id,
        metadata: {},
      },
    ])
    mockSpecialClassFindUnique.mockResolvedValue({ id: "special_class_1", status: "published", classSessionId: session.id })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("checked_in")
    expect(data.cashPending).toBe(true)
  })

  it("does not check in a special-class purchase when its class is cancelled", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      {
        id: "special_purchase_cancelled",
        status: "capture_pending",
        amount: 2500,
        courseSlug: "salsa-night",
        specialClassId: "special_class_1",
        classSessionId: session.id,
        metadata: {},
      },
    ])
    mockSpecialClassFindUnique.mockResolvedValue({ id: "special_class_1", status: "cancelled", classSessionId: session.id })
    mockAttendanceFindUnique.mockResolvedValue({ id: "att_scheduled", status: "scheduled", checkedInAt: session.startsAt, packageUsage: null })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("rejected")
    expect(data.message).toMatch(/not available/i)
    expect(mockAttendanceUpdate).not.toHaveBeenCalled()
  })

  it("does not check in a linked special-class purchase for a different canonical session", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      {
        id: "special_purchase_wrong_session",
        status: "paid",
        amount: 2500,
        courseSlug: "salsa-night",
        specialClassId: "special_class_1",
        classSessionId: "session_other",
        metadata: { date: "2026-06-11" },
      },
    ])
    mockSpecialClassFindUnique.mockResolvedValue({ id: "special_class_1", status: "published", classSessionId: "session_other" })
    mockAttendanceFindUnique.mockResolvedValue({ id: "att_scheduled", status: "scheduled", checkedInAt: session.startsAt, packageUsage: null })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("rejected")
    expect(data.message).toMatch(/not available/i)
    expect(mockAttendanceUpdate).not.toHaveBeenCalled()
  })

  it("returns already_checked_in for an existing special-class attendance without mutating it", async () => {
    mockAttendanceFindUnique.mockResolvedValue({
      id: "att_special_checked_in", status: "checked_in", checkedInAt: NOW, packageUsage: null,
    })

    const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
    const res = await POST(buildRequest(defaultBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("already_checked_in")
    expect(mockAttendanceCreate).not.toHaveBeenCalled()
    expect(mockAttendanceUpdate).not.toHaveBeenCalled()
  })

  // The QR time gate was intentionally removed (commit 19c0c1f). A valid
  // booking now checks in regardless of how far the current time is from the
  // class start, including in production — there is no "window_closed" status.
  it("checks in a valid purchase far from class time (QR time gate removed) in production", async () => {
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
