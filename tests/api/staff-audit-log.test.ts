import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockAuthorizeOwner = vi.fn()

const mockPrisma = {
  studentDataAudit: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwner(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const USER_ID = "user_student_1"
const NOW = new Date("2026-04-29T12:00:00.000Z")

const buildAuditEntry = (overrides: Partial<{
  id: string
  targetUserId: string
  staffClerkId: string
  staffName: string | null
  entity: string
  entityId: string | null
  field: string
  valueBefore: unknown
  valueAfter: unknown
  reason: string
  ipAddress: string | null
  createdAt: Date
}> = {}) => ({
  id: overrides.id ?? "audit_1",
  targetUserId: overrides.targetUserId ?? USER_ID,
  staffClerkId: overrides.staffClerkId ?? "staff_owner_1",
  staffName: overrides.staffName ?? "John Admin",
  entity: overrides.entity ?? "attendance",
  entityId: overrides.entityId ?? "attendance_1",
  field: overrides.field ?? "status",
  valueBefore: overrides.valueBefore ?? "scheduled",
  valueAfter: overrides.valueAfter ?? "checked_in",
  reason: overrides.reason ?? "Student arrived late",
  ipAddress: overrides.ipAddress ?? "192.168.1.1",
  createdAt: overrides.createdAt ?? NOW,
})

// ============================================================
// Per-student audit log: GET /api/staff/students/[userId]/audit-log
// ============================================================

describe("GET /api/staff/students/[userId]/audit-log", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })

    mockPrisma.studentDataAudit.count.mockReset()
    mockPrisma.studentDataAudit.findMany.mockReset()

    mockPrisma.studentDataAudit.count.mockResolvedValue(1)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([buildAuditEntry()])
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(401)
  })

  it("returns paginated audit entries for a student", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.entries).toHaveLength(1)
    expect(data.data.pagination).toEqual({
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
  })

  it("filters by entity", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?entity=payment`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.studentDataAudit.count).toHaveBeenCalledWith({
      where: { targetUserId: USER_ID, entity: "payment" },
    })
  })

  it("returns 400 for invalid entity filter", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?entity=invalid`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid entity filter") })
  })

  it("returns 400 for invalid page parameter", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?page=0`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid page parameter." })
  })

  it("returns 400 for invalid pageSize parameter", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?pageSize=999`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid pageSize") })
  })

  it("supports pagination with page and pageSize", async () => {
    mockPrisma.studentDataAudit.count.mockResolvedValue(150)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      buildAuditEntry({ id: "audit_51" }),
      buildAuditEntry({ id: "audit_52" }),
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?page=2&pageSize=50`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.pagination).toEqual({
      page: 2,
      pageSize: 50,
      total: 150,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    })
  })

  it("returns empty list when no entries exist", async () => {
    mockPrisma.studentDataAudit.count.mockResolvedValue(0)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.entries).toEqual([])
    expect(data.data.pagination.total).toBe(0)
  })

  it("filters by fromDate and toDate", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?fromDate=2026-04-01&toDate=2026-04-30`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const whereArg = mockPrisma.studentDataAudit.count.mock.calls[0][0].where
    expect(whereArg.createdAt).toHaveProperty("gte")
    expect(whereArg.createdAt).toHaveProperty("lte")
  })

  it("returns 400 for invalid fromDate", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?fromDate=not-a-date`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid date format") })
  })

  it("returns 400 for invalid toDate", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?toDate=not-a-date`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid date format") })
  })

  it("returns 400 when fromDate is after toDate", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?fromDate=2026-05-01&toDate=2026-04-01`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "'fromDate' must be on or before 'toDate'." })
  })

  it("combines date filter with entity filter", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?entity=payment&fromDate=2026-04-01&toDate=2026-04-30`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const whereArg = mockPrisma.studentDataAudit.count.mock.calls[0][0].where
    expect(whereArg.entity).toBe("payment")
    expect(whereArg.createdAt).toHaveProperty("gte")
    expect(whereArg.createdAt).toHaveProperty("lte")
  })
})

// ============================================================
// Global audit log: GET /api/staff/audit-log (owner-only)
// ============================================================

describe("GET /api/staff/audit-log (global, owner-only)", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwner.mockReset()
    mockAuthorizeOwner.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })

    mockPrisma.studentDataAudit.count.mockReset()
    mockPrisma.studentDataAudit.findMany.mockReset()

    mockPrisma.studentDataAudit.count.mockResolvedValue(1)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([buildAuditEntry()])
  })

  it("allows owner access", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log"))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it("returns 403 for admin role", async () => {
    mockAuthorizeOwner.mockResolvedValue({ ok: false, status: 403, error: "Owner role required" })

    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log"))

    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeOwner.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log"))

    expect(res.status).toBe(401)
  })

  it("filters by staffId", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?staffId=staff_123"))

    expect(res.status).toBe(200)
    expect(mockPrisma.studentDataAudit.count).toHaveBeenCalledWith({
      where: { staffClerkId: "staff_123" },
    })
  })

  it("filters by entity", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?entity=payment"))

    expect(res.status).toBe(200)
    expect(mockPrisma.studentDataAudit.count).toHaveBeenCalledWith({
      where: { entity: "payment" },
    })
  })

  it("filters by date range", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?from=2026-04-01&to=2026-04-30"))

    expect(res.status).toBe(200)
    const whereArg = mockPrisma.studentDataAudit.count.mock.calls[0][0].where
    expect(whereArg.createdAt).toHaveProperty("gte")
    expect(whereArg.createdAt).toHaveProperty("lte")
  })

  it("returns 400 when from date is after to date", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?from=2026-05-01&to=2026-04-01"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "'from' date must be on or before 'to' date." })
  })

  it("returns 400 for invalid from date", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?from=not-a-date"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid 'from' date") })
  })

  it("returns 400 for invalid to date", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?to=not-a-date"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid 'to' date") })
  })

  it("returns 400 for invalid entity filter", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?entity=invalid"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid entity filter") })
  })

  it("combines multiple filters", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(
      new Request("http://localhost/api/staff/audit-log?staffId=staff_123&entity=attendance&from=2026-04-01&to=2026-04-30")
    )

    expect(res.status).toBe(200)
    const whereArg = mockPrisma.studentDataAudit.count.mock.calls[0][0].where
    expect(whereArg.staffClerkId).toBe("staff_123")
    expect(whereArg.entity).toBe("attendance")
    expect(whereArg.createdAt).toHaveProperty("gte")
    expect(whereArg.createdAt).toHaveProperty("lte")
  })

  it("returns entries sorted by createdAt desc", async () => {
    const { GET } = await import("@/app/api/staff/audit-log/route")
    await GET(new Request("http://localhost/api/staff/audit-log"))

    expect(mockPrisma.studentDataAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    )
  })

  it("returns pagination metadata with hasNext/hasPrev", async () => {
    mockPrisma.studentDataAudit.count.mockResolvedValue(150)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      buildAuditEntry({ id: "audit_51" }),
      buildAuditEntry({ id: "audit_52" }),
    ])

    const { GET } = await import("@/app/api/staff/audit-log/route")
    const res = await GET(new Request("http://localhost/api/staff/audit-log?page=2&pageSize=50"))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.pagination).toEqual({
      page: 2,
      pageSize: 50,
      total: 150,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    })
  })
})
