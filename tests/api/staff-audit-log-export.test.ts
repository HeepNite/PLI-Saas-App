import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()

const mockPrisma = {
  studentDataAudit: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
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

describe("GET /api/staff/students/[userId]/audit-log/export", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })

    mockPrisma.studentDataAudit.findMany.mockReset()
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([buildAuditEntry()])
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(401)
  })

  it("returns CSV with correct content-type header", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/csv")
  })

  it("returns CSV with Content-Disposition header", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.headers.get("Content-Disposition")).toContain("attachment")
    expect(res.headers.get("Content-Disposition")).toContain("audit-log")
  })

  it("returns CSV with correct column headers", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    const csv = await res.text()
    const firstLine = csv.split("\n")[0]
    expect(firstLine).toBe("Date,Staff,Entity,Field,Before,After,Reason")
  })

  it("returns CSV rows with correct data", async () => {
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      buildAuditEntry({
        id: "audit_1",
        staffName: "Jane Staff",
        entity: "payment",
        field: "amount",
        valueBefore: "0",
        valueAfter: "100",
        reason: "Manual adjustment",
        createdAt: new Date("2026-04-15T10:30:00.000Z"),
      }),
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    const csv = await res.text()
    const lines = csv.trim().split("\n")
    expect(lines).toHaveLength(2) // header + 1 row
    expect(lines[1]).toContain("Jane Staff")
    expect(lines[1]).toContain("payment")
    expect(lines[1]).toContain("amount")
    expect(lines[1]).toContain("Manual adjustment")
  })

  it("caps results at 10,000 rows and sets warning header", async () => {
    // Simulate 10,001 results from Prisma (the route caps at 10k)
    const manyEntries = Array.from({ length: 10001 }, (_, i) =>
      buildAuditEntry({ id: `audit_${i}` })
    )
    mockPrisma.studentDataAudit.findMany.mockResolvedValue(manyEntries)

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.headers.get("X-Row-Cap-Reached")).toBe("true")
    expect(res.headers.get("X-Row-Count")).toBe("10000")

    const csv = await res.text()
    const lines = csv.trim().split("\n")
    expect(lines).toHaveLength(10001) // header + 10k rows
  })

  it("returns headers-only CSV when no entries exist", async () => {
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const csv = await res.text()
    expect(csv.trim()).toBe("Date,Staff,Entity,Field,Before,After,Reason")
    expect(res.headers.get("X-Row-Count")).toBe("0")
  })

  it("passes fromDate and toDate to Prisma query", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export?fromDate=2026-04-01&toDate=2026-04-30`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    const whereArg = mockPrisma.studentDataAudit.findMany.mock.calls[0][0].where
    expect(whereArg.targetUserId).toBe(USER_ID)
    expect(whereArg.createdAt).toHaveProperty("gte")
    expect(whereArg.createdAt).toHaveProperty("lte")
  })

  it("returns 400 for invalid date format", async () => {
    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export?fromDate=not-a-date`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid date format") })
  })

  it("escapes CSV values containing commas", async () => {
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      buildAuditEntry({
        reason: "Late arrival, excused",
        valueBefore: "scheduled, pending",
      }),
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    const csv = await res.text()
    // Values with commas should be quoted
    expect(csv).toContain('"Late arrival, excused"')
    expect(csv).toContain('"scheduled, pending"')
  })

  it("escapes CSV values containing double quotes", async () => {
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      buildAuditEntry({
        reason: 'Said "hello"',
      }),
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/export/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log/export`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    const csv = await res.text()
    // Double quotes should be escaped as ""
    expect(csv).toContain('"Said ""hello"""')
  })
})
