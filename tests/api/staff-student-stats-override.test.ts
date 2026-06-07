import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  attendance: {
    count: vi.fn(),
  },
  packagePurchase: {
    findFirst: vi.fn(),
  },
  packageUsageLedger: {
    count: vi.fn(),
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

describe("PATCH /api/staff/students/[userId]/stats", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.user.update.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.packagePurchase.findFirst.mockReset()
    mockPrisma.packageUsageLedger.count.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })
    mockPrisma.user.update.mockResolvedValue({ id: USER_ID })
    mockPrisma.attendance.count.mockResolvedValue(45)
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)
    mockPrisma.packageUsageLedger.count.mockResolvedValue(0)
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 400 when reason is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Reason is required (max 500 characters)." })
  })

  it("returns 400 when no valid stat fields provided", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test", invalidField: "value" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("No valid fields") })
  })

  it("returns 400 when completedClasses is negative", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test", completedClasses: -1 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "completedClasses must be a non-negative integer." })
  })

  it("returns 400 when completedClasses is not an integer", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test", completedClasses: 45.5 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
  })

  it("returns 400 when packageClassesUsed is negative", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test", packageClassesUsed: -3 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "packageClassesUsed must be a non-negative integer." })
  })

  it("corrects completedClasses", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Corrected completed classes",
          completedClasses: 46,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.stats.corrections).toContainEqual({
      field: "completedClasses",
      correctedTo: 46,
    })
    expect(mockPrisma.attendance.count).toHaveBeenCalled()
  })

  it("corrects packageClassesUsed", async () => {
    mockPrisma.packagePurchase.findFirst.mockResolvedValue({ id: "pkg_1" })
    mockPrisma.packageUsageLedger.count.mockResolvedValue(8)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Corrected package usage",
          packageClassesUsed: 9,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.stats.corrections).toContainEqual({
      field: "packageClassesUsed",
      correctedTo: 9,
    })
  })

  it("corrects both stats in one request", async () => {
    mockPrisma.packagePurchase.findFirst.mockResolvedValue({ id: "pkg_1" })
    mockPrisma.packageUsageLedger.count.mockResolvedValue(8)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Corrected all stats",
          completedClasses: 46,
          packageClassesUsed: 9,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.stats.corrections).toHaveLength(2)
  })

  it("returns 404 when student not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Test",
          completedClasses: 46,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })
})
