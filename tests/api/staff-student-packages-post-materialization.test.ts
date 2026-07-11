import { beforeEach, describe, expect, it, vi } from "vitest"

// End-to-end coverage for the admin cash-package grant lifecycle:
// POST /api/staff/students/[userId]/packages creates a pending cash Purchase
// seeded from a PackagePlan, and the EXISTING (unmodified) mark-paid path
// (`syncPackagePurchaseFromPaidPurchase` in lib/packages.ts) materializes the
// PackagePurchase from that same metadata. This suite exercises the real,
// unmocked `lib/packages.ts` implementation against a mock Prisma client to
// confirm the packageValidDays translation lands the correct expiresAt.

const mockAuthorizeStudentOperational = vi.fn()
const mockWriteAudit = vi.fn()

type MockPurchase = {
  id: string
  userId: string
  status: string
  packageId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

const mockPrisma = {
  user: { findUnique: vi.fn() },
  packagePlan: { findFirst: vi.fn(), upsert: vi.fn() },
  packagePurchase: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  purchase: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: vi.fn(),
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperational(...args),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const USER_ID = "user_student_1"
const PLAN_ID = "plan_10class"
const STAFF_USER_ID = "staff_front_desk_1"

const buildPlan = (overrides: Partial<{ validDays: number; isUnlimited: boolean; totalCredits: number | null }> = {}) => ({
  id: PLAN_ID,
  key: "pkg_10class",
  label: "10 Class Pack",
  priceCents: 15000,
  totalCredits: overrides.isUnlimited ? null : (overrides.totalCredits ?? 10),
  isUnlimited: overrides.isUnlimited ?? false,
  validDays: overrides.validDays ?? 90,
  cadence: "weekly",
  makeUps: 1,
  active: true,
  courseSlug: "yoga-101",
  courseSlugs: [] as string[],
})

// Every request needs an idempotencyKey (now required — see the DB-backed concurrency guard).
const makePostRequest = (userId: string, body: Record<string, unknown>) =>
  new Request(`http://localhost/api/staff/students/${userId}/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `idem-${Math.random().toString(36).slice(2)}`, ...body }),
  })

const makeContext = (userId: string) => ({ params: Promise.resolve({ userId }) })

let createdPurchases: MockPurchase[]
let createdPackagePurchases: Array<Record<string, unknown>>

describe("admin cash package grant -> mark-paid materialization (end to end)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()

    mockAuthorizeStudentOperational.mockReset()
    mockAuthorizeStudentOperational.mockResolvedValue({
      ok: true,
      userId: STAFF_USER_ID,
      role: "staff",
      category: "front_desk",
      staffName: "Front Desk Staff",
    })
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.packagePlan.findFirst.mockReset()
    mockPrisma.packagePlan.upsert.mockReset()
    mockPrisma.packagePurchase.findFirst.mockReset()
    mockPrisma.packagePurchase.findUnique.mockReset()
    mockPrisma.packagePurchase.create.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$transaction.mockReset()

    createdPurchases = []
    createdPackagePurchases = []

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })
    mockPrisma.packagePlan.findFirst.mockResolvedValue(buildPlan())
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(null)
    mockPrisma.packagePlan.upsert.mockResolvedValue({ id: PLAN_ID })

    let purchaseCounter = 0
    mockPrisma.purchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      purchaseCounter += 1
      const purchase: MockPurchase = {
        id: `purchase_${purchaseCounter}`,
        userId: data.userId as string,
        status: data.status as string,
        packageId: (data.packageId as string) ?? null,
        metadata: data.metadata as Record<string, unknown>,
        createdAt: new Date("2026-07-11T12:00:00.000Z"),
      }
      createdPurchases.push(purchase)
      return purchase
    })

    let packagePurchaseCounter = 0
    mockPrisma.packagePurchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      packagePurchaseCounter += 1
      const packagePurchase = { id: `pkg_purchase_${packagePurchaseCounter}`, ...data }
      createdPackagePurchases.push(packagePurchase)
      return packagePurchase
    })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
  })

  const markPaidWithRealSync = async (purchase: MockPurchase) => {
    const { syncPackagePurchaseFromPaidPurchase } = await vi.importActual<typeof import("@/lib/packages")>(
      "@/lib/packages"
    )

    return syncPackagePurchaseFromPaidPurchase({
      userId: purchase.userId,
      purchaseId: purchase.id,
      purchasedAt: purchase.createdAt,
      source: "cash",
      metadata: {
        courseSlug: purchase.metadata.courseSlug as string | undefined,
        packageId: purchase.packageId || (purchase.metadata.packageId as string),
        packageLabel: purchase.metadata.packageLabel as string | undefined,
        packageTotalCredits: purchase.metadata.packageTotalCredits as string | undefined,
        packageIsUnlimited: purchase.metadata.packageIsUnlimited as string | undefined,
        packageCadence: purchase.metadata.packageCadence as string | undefined,
        packageMakeUps: purchase.metadata.packageMakeUps as string | undefined,
        packageValidDays: purchase.metadata.packageValidDays as string | undefined,
      },
    })
  }

  it("materializes PackagePurchase with the staff-supplied expiresAt override honored", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-11T12:00:00.000Z"))

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, {
        packagePlanId: PLAN_ID,
        reason: "Cash sale",
        expiresAt: "2026-08-10T12:00:00.000Z", // exactly 30 days from "now"
      }),
      makeContext(USER_ID)
    )
    expect(res.status).toBe(201)
    expect(createdPurchases).toHaveLength(1)
    expect(createdPackagePurchases).toHaveLength(0) // no materialization at grant time

    vi.useRealTimers()

    const synced = await markPaidWithRealSync(createdPurchases[0])
    expect(synced).toBeTruthy()
    expect(createdPackagePurchases).toHaveLength(1)

    const materialized = createdPackagePurchases[0] as { expiresAt: Date; purchasedAt: Date }
    // purchasedAt (createdAt of the pending purchase) + 30 days translated from expiresAt override.
    const expectedExpiry = new Date(createdPurchases[0].createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    expect(materialized.expiresAt.toISOString()).toBe(expectedExpiry.toISOString())
  })

  it("materializes PackagePurchase using purchasedAt + plan.validDays when no override is supplied", async () => {
    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
      makeContext(USER_ID)
    )
    expect(res.status).toBe(201)

    const synced = await markPaidWithRealSync(createdPurchases[0])
    expect(synced).toBeTruthy()

    const materialized = createdPackagePurchases[0] as { expiresAt: Date }
    const expectedExpiry = new Date(createdPurchases[0].createdAt.getTime() + 90 * 24 * 60 * 60 * 1000)
    expect(materialized.expiresAt.toISOString()).toBe(expectedExpiry.toISOString())
  })

  it("stays idempotent when syncPackagePurchaseFromPaidPurchase runs twice for the same purchaseId", async () => {
    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

    await markPaidWithRealSync(createdPurchases[0])
    expect(createdPackagePurchases).toHaveLength(1)

    // Second sync call should short-circuit because the PackagePurchase already exists.
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(createdPackagePurchases[0])
    const secondSync = await markPaidWithRealSync(createdPurchases[0])

    expect(createdPackagePurchases).toHaveLength(1)
    expect(secondSync).toEqual(createdPackagePurchases[0])
  })

  it("materializes an unlimited plan with isUnlimited true and null totalCredits/remainingCredits", async () => {
    mockPrisma.packagePlan.findFirst.mockResolvedValue(buildPlan({ isUnlimited: true, totalCredits: null }))

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
      makeContext(USER_ID)
    )
    expect(res.status).toBe(201)

    const synced = await markPaidWithRealSync(createdPurchases[0])
    expect(synced).toBeTruthy()
    expect(createdPackagePurchases).toHaveLength(1)

    const materialized = createdPackagePurchases[0] as {
      isUnlimited: boolean
      totalCredits: number | null
      remainingCredits: number | null
    }
    expect(materialized.isUnlimited).toBe(true)
    expect(materialized.totalCredits).toBeNull()
    expect(materialized.remainingCredits).toBeNull()
  })
})
