import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockAuthorizeCashPackageGrant = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  packagePurchase: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  packagePlan: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
  authorizeCashPackageGrantRequest: (...args: unknown[]) => mockAuthorizeCashPackageGrant(...args),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const USER_ID = "user_student_1"
const PACKAGE_ID = "pkg_purchase_1"

const buildPackage = (overrides: Partial<{
  id: string
  userId: string
  totalCredits: number | null
  remainingCredits: number
  isUnlimited: boolean
  status: string
  expiresAt: Date | null
}> = {}) => ({
  id: overrides.id ?? PACKAGE_ID,
  userId: overrides.userId ?? USER_ID,
  packageId: "pkg_1",
  packageLabel: "10 Class Pack",
  totalCredits: overrides.totalCredits ?? 10,
  remainingCredits: overrides.remainingCredits ?? 7,
  isUnlimited: overrides.isUnlimited ?? false,
  status: overrides.status ?? "active",
  expiresAt: overrides.expiresAt ?? null,
  purchasedAt: new Date("2026-01-01"),
})

describe("PATCH /api/staff/students/[userId]/packages", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })
    mockAuthorizeCashPackageGrant.mockReset()
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.packagePurchase.findUnique.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.packagePurchase.update.mockReset()
    mockPrisma.packagePlan.findMany.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(buildPackage())
    mockPrisma.packagePurchase.findMany.mockResolvedValue([buildPackage()])
  })

  it("lists package purchases for the student", async () => {
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      buildPackage({ id: "pkg_a", totalCredits: 10, remainingCredits: 6, status: "active" }),
      buildPackage({ id: "pkg_b", totalCredits: 8, remainingCredits: 0, status: "expired" }),
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, { method: "GET" }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.packages).toHaveLength(2)
    expect(data.data.packages[0]).toMatchObject({
      id: "pkg_a",
      usedCredits: 4,
    })
    expect(mockAuthorizeOwnerOrAdmin).toHaveBeenCalledOnce()
    expect(mockAuthorizeCashPackageGrant).not.toHaveBeenCalled()
  })

  it("lists only active plans for an authorized grant picker", async () => {
    mockAuthorizeCashPackageGrant.mockResolvedValue({
      ok: true,
      userId: "user_staff_1",
      role: "staff",
      category: "front_desk",
      subCategory: null,
      staffName: "Front Desk",
    })
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })
    mockPrisma.packagePlan.findMany.mockResolvedValue([
      { id: "plan_1", key: "ten-class-pack", label: "10 Class Pack", priceCents: 12000, cadence: "monthly", totalCredits: 10, isUnlimited: false },
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await GET(new Request(`http://localhost/api/staff/students/${USER_ID}/packages?intent=grant`), { params: Promise.resolve({ userId: USER_ID }) })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      data: { plans: [{ id: "plan_1", key: "ten-class-pack", label: "10 Class Pack", priceCents: 12000, cadence: "monthly", totalCredits: 10, isUnlimited: false }] },
    })
    expect(mockPrisma.packagePlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }))
  })

  it.each([401, 403])("returns %i when grant authorization denies the request", async (status) => {
    mockAuthorizeCashPackageGrant.mockResolvedValue({ ok: false, status, error: "Insufficient role" })

    const { GET } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await GET(new Request(`http://localhost/api/staff/students/${USER_ID}/packages?intent=grant`), { params: Promise.resolve({ userId: USER_ID }) })

    expect(res.status).toBe(status)
    await expect(res.json()).resolves.toEqual({ error: "Insufficient role" })
  })

  it("returns 404 when listing packages for missing student", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { GET } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, { method: "GET" }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "Student not found" })
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 400 when packagePurchaseId is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "packagePurchaseId is required." })
  })

  it("returns 400 when reason is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Reason is required (max 500 characters)." })
  })

  it("returns 400 when remainingCredits is negative", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test", remainingCredits: -1 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "remainingCredits must be a non-negative integer." })
  })

  it("returns 400 when usedCredits is negative", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test", usedCredits: -5 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "usedCredits must be a non-negative integer." })
  })

  it("returns 400 when status is invalid", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test", status: "invalid" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid status") })
  })

  it("returns 400 when expiresAt is not a valid ISO date", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test", expiresAt: "not-a-date" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "expiresAt must be a valid ISO date string." })
  })

  it("returns 400 when remainingCredits exceeds totalCredits", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packagePurchaseId: PACKAGE_ID, reason: "Test", remainingCredits: 999 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "remainingCredits cannot exceed totalCredits." })
  })

  it("updates remainingCredits successfully", async () => {
    mockPrisma.packagePurchase.update.mockResolvedValue(buildPackage({ remainingCredits: 5 }))
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Adjusted credits",
          remainingCredits: 5,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.packagePurchase.update).toHaveBeenCalled()
  })

  it("updates status to paused", async () => {
    mockPrisma.packagePurchase.update.mockResolvedValue(buildPackage({ status: "paused" }))
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Student requested pause",
          status: "paused",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
  })

  it("updates expiration date", async () => {
    mockPrisma.packagePurchase.update.mockResolvedValue(buildPackage({
      expiresAt: new Date("2026-06-01"),
    }))
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Extended expiration",
          expiresAt: "2026-06-01T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
  })

  it("returns 403 when package does not belong to student", async () => {
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(buildPackage({ userId: "other_student" }))
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Test",
          remainingCredits: 5,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Package does not belong to this student." })
  })

  it("returns 404 when package not found", async () => {
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Test",
          remainingCredits: 5,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })

  it("allows remainingCredits to exceed totalCredits for unlimited packages", async () => {
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(buildPackage({ isUnlimited: true, totalCredits: null, remainingCredits: 100 }))
    mockPrisma.packagePurchase.update.mockResolvedValue(buildPackage({ isUnlimited: true, totalCredits: null, remainingCredits: 500 }))
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Added unlimited credits",
          remainingCredits: 500,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
  })
})
