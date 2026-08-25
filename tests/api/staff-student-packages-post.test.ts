import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"
import { PAYMENT_CHANNEL, PURCHASE_SOURCE, SETTLEMENT_STATUS } from "@/lib/payment-constants"

const makeUniqueConstraintError = (target: string) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [target] },
  })

const mockAuthorizeStudentOperational = vi.fn()
const mockWriteAudit = vi.fn()

type MockPurchase = {
  id: string
  userId: string
  status: string
  packageId: string | null
  idempotencyKey: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  packagePlan: {
    findFirst: vi.fn(),
  },
  packagePurchase: {
    findFirst: vi.fn(),
  },
  purchase: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: vi.fn(),
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperational(...args),
  authorizeCashPackageGrantRequest: (...args: unknown[]) => mockAuthorizeStudentOperational(...args),
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

const buildPlan = (overrides: Partial<{
  id: string
  key: string
  label: string
  priceCents: number | null
  totalCredits: number | null
  isUnlimited: boolean
  validDays: number
  cadence: string | null
  makeUps: number
  active: boolean
  courseSlug: string | null
  courseSlugs: string[]
}> = {}) => ({
  id: overrides.id ?? PLAN_ID,
  key: overrides.key ?? "pkg_10class",
  label: overrides.label ?? "10 Class Pack",
  priceCents: overrides.priceCents === undefined ? 15000 : overrides.priceCents,
  totalCredits: overrides.totalCredits === undefined ? 10 : overrides.totalCredits,
  isUnlimited: overrides.isUnlimited ?? false,
  validDays: overrides.validDays ?? 90,
  cadence: overrides.cadence ?? "weekly",
  makeUps: overrides.makeUps ?? 1,
  active: overrides.active ?? true,
  courseSlug: overrides.courseSlug ?? "yoga-101",
  courseSlugs: overrides.courseSlugs ?? [],
})

// Every request needs an idempotencyKey (now required — see the DB-backed concurrency guard).
// Tests that specifically exercise idempotency pass their own key explicitly via `body`.
const makePostRequest = (userId: string, body: Record<string, unknown>) =>
  new Request(`http://localhost/api/staff/students/${userId}/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `idem-${Math.random().toString(36).slice(2)}`, ...body }),
  })

const makeContext = (userId: string) => ({ params: Promise.resolve({ userId }) })

let createdPurchases: MockPurchase[] = []

describe("POST /api/staff/students/[userId]/packages", () => {
  beforeEach(() => {
    vi.resetModules()
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
    mockPrisma.packagePurchase.findFirst.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$transaction.mockReset()

    createdPurchases = []

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })
    mockPrisma.packagePlan.findFirst.mockResolvedValue(buildPlan())
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)
    // Default: look up by idempotencyKey against whatever has been created so far, mirroring
    // the real unique-column lookup used both for the pre-check and the P2002-recovery path.
    mockPrisma.purchase.findFirst.mockImplementation(async ({ where }: { where: { idempotencyKey?: string } }) =>
      createdPurchases.find((p) => p.idempotencyKey === where.idempotencyKey) ?? null
    )

    let purchaseCounter = 0
    mockPrisma.purchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const key = (data.idempotencyKey as string | null) ?? null
      if (key && createdPurchases.some((p) => p.idempotencyKey === key)) {
        throw makeUniqueConstraintError("Purchase_idempotencyKey_key")
      }
      purchaseCounter += 1
      const purchase: MockPurchase = {
        id: `purchase_${purchaseCounter}`,
        userId: data.userId as string,
        status: data.status as string,
        packageId: (data.packageId as string) ?? null,
        idempotencyKey: key,
        metadata: data.metadata as Record<string, unknown>,
        createdAt: new Date("2026-07-11T12:00:00.000Z"),
      }
      createdPurchases.push(purchase)
      return purchase
    })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
  })

  it("creates a pending cash Purchase seeded from the plan", async () => {
    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash package sold at front desk" }),
      makeContext(USER_ID)
    )

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.settlementStatus).toBe("pending")
    expect(data.data.purchaseId).toBe("purchase_1")

    expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    const createdMetadata = createdPurchases[0].metadata
    expect(createdPurchases[0].status).toBe("pending")
    expect(createdMetadata).toMatchObject({
      source: "cash_checkout",
      purchaseSource: PURCHASE_SOURCE.FRONT_DESK,
      paymentMethod: "onsite",
      paymentChannel: PAYMENT_CHANNEL.CASH,
      settlementStatus: SETTLEMENT_STATUS.PENDING,
      settledAt: null,
      packageId: "pkg_10class",
      packageLabel: "10 Class Pack",
      packageTotalCredits: "10",
      packageIsUnlimited: "false",
      packageCadence: "weekly",
      packageMakeUps: "1",
      packageValidDays: "90",
      requiresCardMigration: true,
    })

    // No PackagePurchase materialized at this step.
    expect(mockPrisma.packagePurchase.findFirst).toHaveBeenCalled()
  })

  it("supports lookup by plan key instead of packagePlanId", async () => {
    mockPrisma.packagePlan.findFirst.mockResolvedValue(buildPlan())

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { key: "pkg_10class", reason: "Cash sale" }),
      makeContext(USER_ID)
    )

    expect(res.status).toBe(201)
    expect(mockPrisma.packagePlan.findFirst).toHaveBeenCalledWith({ where: { key: "pkg_10class" } })
  })

  it("returns 400 when neither packagePlanId nor key is provided", async () => {
    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(makePostRequest(USER_ID, { reason: "Cash sale" }), makeContext(USER_ID))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "packagePlanId or key is required." })
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID }), makeContext(USER_ID))

    expect(res.status).toBe(400)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown packagePlanId and creates no records", async () => {
    mockPrisma.packagePlan.findFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: "does_not_exist", reason: "Cash sale" }),
      makeContext(USER_ID)
    )

    expect(res.status).toBe(404)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 400 for an inactive plan and creates no records", async () => {
    mockPrisma.packagePlan.findFirst.mockResolvedValue(buildPlan({ active: false }))

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
      makeContext(USER_ID)
    )

    expect(res.status).toBe(400)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 404 when the student does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await POST(
      makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
      makeContext(USER_ID)
    )

    expect(res.status).toBe(404)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  describe("role gate", () => {
    it("allows owner", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: null, staffName: "Owner" })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
        makeContext(USER_ID)
      )
      expect(res.status).toBe(201)
    })

    it("allows admin", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: null, staffName: "Admin" })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
        makeContext(USER_ID)
      )
      expect(res.status).toBe(201)
    })

    it("allows front_desk staff (including guest front_desk)", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({
        ok: true,
        userId: "guest_fd_1",
        role: "staff",
        category: "guest",
        subCategory: "front_desk",
        staffName: "Guest Front Desk",
      })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
        makeContext(USER_ID)
      )
      expect(res.status).toBe(201)
    })

    it("rejects non-operational staff and unauthenticated callers", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
        makeContext(USER_ID)
      )
      expect(res.status).toBe(403)
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })
  })

  describe("duplicate active package", () => {
    it("returns 409 with existing package info when a duplicate exists and confirmDuplicate is not set", async () => {
      mockPrisma.packagePurchase.findFirst.mockResolvedValue({
        id: "existing_pkg_1",
        packageLabel: "10 Class Pack",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      })

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }),
        makeContext(USER_ID)
      )

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.code).toBe("DUPLICATE_ACTIVE_PACKAGE")
      expect(data.existing).toMatchObject({ id: "existing_pkg_1", label: "10 Class Pack" })
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })

    it("proceeds when confirmDuplicate is true", async () => {
      mockPrisma.packagePurchase.findFirst.mockResolvedValue({
        id: "existing_pkg_1",
        packageLabel: "10 Class Pack",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      })

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", confirmDuplicate: true }),
        makeContext(USER_ID)
      )

      expect(res.status).toBe(201)
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    })
  })

  describe("idempotency", () => {
    it("returns 400 when idempotencyKey is missing", async () => {
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packagePlanId: PLAN_ID, reason: "Cash sale" }),
        }),
        makeContext(USER_ID)
      )
      expect(res.status).toBe(400)
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })

    it("returns the same purchase for a repeated idempotencyKey within the window (pre-check fast path)", async () => {
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")

      const firstRes = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", idempotencyKey: "idem-key-1" }),
        makeContext(USER_ID)
      )
      expect(firstRes.status).toBe(201)
      const firstData = await firstRes.json()

      const secondRes = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", idempotencyKey: "idem-key-1" }),
        makeContext(USER_ID)
      )
      expect(secondRes.status).toBe(200)
      const secondData = await secondRes.json()

      expect(secondData.data.purchaseId).toBe(firstData.data.purchaseId)
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    })

    it("two concurrent POSTs with the same idempotencyKey create exactly one Purchase (DB unique-constraint / P2002 path)", async () => {
      // Simulate a double-click race: the pre-check (which scopes by createdAt window) returns
      // null for both requests because neither purchase exists yet when they read — but the
      // P2002-recovery lookup (no createdAt filter) still finds the winning row, exactly like
      // querying by the real unique idempotencyKey column post-race.
      mockPrisma.purchase.findFirst.mockImplementation(
        async ({ where }: { where: { idempotencyKey?: string; createdAt?: unknown } }) =>
          where.createdAt ? null : createdPurchases.find((p) => p.idempotencyKey === where.idempotencyKey) ?? null
      )

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")

      const firstRes = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", idempotencyKey: "race-key-1" }),
        makeContext(USER_ID)
      )
      expect(firstRes.status).toBe(201)

      // Second racer's create() throws P2002 because the first racer already committed the
      // same idempotencyKey — this is enforced by the mock purchase.create implementation
      // (see beforeEach) mirroring the real Purchase.idempotencyKey unique DB constraint.
      const secondRes = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", idempotencyKey: "race-key-1" }),
        makeContext(USER_ID)
      )

      expect(secondRes.status).toBe(200)
      const secondData = await secondRes.json()
      expect(secondData.ok).toBe(true)
      expect(secondData.data.purchaseId).toBe(createdPurchases[0].id)

      // Exactly one Purchase row was actually created despite two POSTs.
      expect(createdPurchases).toHaveLength(1)
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(2)
    })
  })

  describe("audit trail", () => {
    it("writes a StudentDataAudit entry linking staff, student, and plan", async () => {
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale at front desk" }),
        makeContext(USER_ID)
      )

      expect(mockWriteAudit).toHaveBeenCalledTimes(1)
      const [auditParams] = mockWriteAudit.mock.calls[0]
      expect(auditParams).toMatchObject({
        targetUserId: USER_ID,
        staffClerkId: STAFF_USER_ID,
        entity: "package",
        field: "created",
        reason: "Cash sale at front desk",
      })
      expect(auditParams.valueAfter).toMatchObject({ packagePlanId: PLAN_ID, packageKey: "pkg_10class" })
    })
  })

  describe("purchase metadata parity with tablet cash route", () => {
    it("uses the same package.* metadata keys as app/api/checkout/cash/route.ts", async () => {
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

      const metadata = createdPurchases[0].metadata

      // Keys the tablet cash route seeds for a cash package purchase
      // (app/api/checkout/cash/route.ts ~lines 317-346) that syncPackagePurchaseFromPaidPurchase reads at mark-paid.
      const tabletCashParityKeys = [
        "source",
        "purchaseSource",
        "paymentMethod",
        "paymentChannel",
        "settlementStatus",
        "settledAt",
        "courseSlug",
        "packageId",
        "packageLabel",
        "packageTotalCredits",
        "packageIsUnlimited",
        "packageCadence",
        "packageMakeUps",
        "packageValidDays",
        "requiresCardMigration",
      ]

      for (const key of tabletCashParityKeys) {
        expect(metadata).toHaveProperty(key)
      }

      expect(metadata.source).toBe("cash_checkout")
      expect(metadata.paymentMethod).toBe("onsite")
      expect(metadata.paymentChannel).toBe(PAYMENT_CHANNEL.CASH)
      expect(metadata.settlementStatus).toBe(SETTLEMENT_STATUS.PENDING)
      expect(metadata.settledAt).toBeNull()
      expect(metadata.requiresCardMigration).toBe(true)
      // Package fields are strings, matching validation.packageTotalCredits/etc. serialization in the tablet route.
      expect(typeof metadata.packageTotalCredits).toBe("string")
      expect(typeof metadata.packageIsUnlimited).toBe("string")
      expect(typeof metadata.packageMakeUps).toBe("string")
      expect(typeof metadata.packageValidDays).toBe("string")
    })
  })

  describe("editable expiresAt translation (load-bearing)", () => {
    it("translates an expiresAt override into packageValidDays metadata", async () => {
      // "now" in the handler is Date.now(); pin via fake timers for a stable ceil().
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-07-11T12:00:00.000Z"))

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, {
          packagePlanId: PLAN_ID,
          reason: "Cash sale",
          expiresAt: "2026-08-10T12:00:00.000Z", // 30 days later
        }),
        makeContext(USER_ID)
      )

      expect(res.status).toBe(201)
      expect(createdPurchases[0].metadata.packageValidDays).toBe("30")

      vi.useRealTimers()
    })

    it("defaults to the plan's validDays when no expiresAt override is supplied", async () => {
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

      expect(createdPurchases[0].metadata.packageValidDays).toBe("90")
    })

    it("returns 400 when expiresAt is in the past instead of silently clamping to 1 day", async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-07-11T12:00:00.000Z"))

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, {
          packagePlanId: PLAN_ID,
          reason: "Cash sale",
          expiresAt: "2026-07-10T12:00:00.000Z", // 1 day in the past
        }),
        makeContext(USER_ID)
      )

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: "expiresAt must be in the future." })
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it("returns 400 when expiresAt equals now", async () => {
      const now = new Date("2026-07-11T12:00:00.000Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      const res = await POST(
        makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale", expiresAt: now.toISOString() }),
        makeContext(USER_ID)
      )

      expect(res.status).toBe(400)
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe("purchaseSource by caller role", () => {
    it("uses PURCHASE_SOURCE.ADMIN for owner", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: null, staffName: "Owner" })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

      expect(createdPurchases[0].metadata.purchaseSource).toBe(PURCHASE_SOURCE.ADMIN)
    })

    it("uses PURCHASE_SOURCE.ADMIN for admin", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: null, staffName: "Admin" })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

      expect(createdPurchases[0].metadata.purchaseSource).toBe(PURCHASE_SOURCE.ADMIN)
    })

    it("uses PURCHASE_SOURCE.FRONT_DESK for front-desk staff", async () => {
      mockAuthorizeStudentOperational.mockResolvedValue({
        ok: true,
        userId: "fd_1",
        role: "staff",
        category: "front_desk",
        staffName: "Front Desk Staff",
      })
      const { POST } = await import("@/app/api/staff/students/[userId]/packages/route")
      await POST(makePostRequest(USER_ID, { packagePlanId: PLAN_ID, reason: "Cash sale" }), makeContext(USER_ID))

      expect(createdPurchases[0].metadata.purchaseSource).toBe(PURCHASE_SOURCE.FRONT_DESK)
    })
  })
})
