import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  packagePurchase: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
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
  totalCredits: number
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
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.packagePurchase.findUnique.mockReset()
    mockPrisma.packagePurchase.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })
    mockPrisma.packagePurchase.findUnique.mockResolvedValue(buildPackage())
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
