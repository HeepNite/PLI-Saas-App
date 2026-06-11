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
const mockPackagePurchaseUpdate = vi.fn()
const mockPackageUsageLedgerCreate = vi.fn()
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
  mockPurchaseFindMany.mockResolvedValue([])
  mockPackagePurchaseFindMany.mockResolvedValue([])
  mockAttendanceCount.mockResolvedValue(1)
  mockGetMilestoneClasses.mockResolvedValue(5)
  mockAwardPoints.mockResolvedValue({ awarded: false, points: 0 })
  vi.useFakeTimers({ now: NOW })
}

describe("POST /api/checkin/qr/client-phone", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        packagePurchase: { update: mockPackagePurchaseUpdate },
        attendance: { create: () => createdAttendance },
        packageUsageLedger: { create: mockPackageUsageLedgerCreate },
      }
      return fn(tx)
    })
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

  it("returns window_closed when outside check-in window in production", async () => {
    const origEnv = process.env.NODE_ENV
    try {
      // @ts-expect-error -- override for test
      process.env.NODE_ENV = "production"
      vi.useRealTimers()
      vi.useFakeTimers({ now: new Date("2026-06-11T10:00:00Z") }) // 10 hours before class

      // Re-import to pick up production env
      vi.resetModules()
      setupDefaults()
      const { POST } = await import("@/app/api/checkin/qr/client-phone/route")
      const res = await POST(buildRequest(defaultBody))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe("window_closed")
    } finally {
      // @ts-expect-error -- restore
      process.env.NODE_ENV = origEnv
    }
  })
})
