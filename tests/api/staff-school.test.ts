import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockPrisma = {
  courseCatalog: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  packagePlan: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  pointsRule: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  pointsLedger: {
    findFirst: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff school routes", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })

    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.courseCatalog.upsert.mockReset()
    mockPrisma.packagePlan.findMany.mockReset()
    mockPrisma.packagePlan.upsert.mockReset()
    mockPrisma.pointsRule.findMany.mockReset()
    mockPrisma.pointsRule.upsert.mockReset()
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.pointsLedger.findFirst.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockPrisma.pointsLedger.aggregate.mockReset()

    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.packagePlan.findMany.mockResolvedValue([])
    mockPrisma.pointsRule.findMany.mockResolvedValue([])
    mockPrisma.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 0 } })
  })

  it("GET courses returns auth error when portal auth fails", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { GET } = await import("@/app/api/staff/school/courses/route")
    const res = await GET(new Request("http://localhost/api/staff/school/courses"))
    expect(res.status).toBe(403)
  })

  it("POST courses upserts sanitized course catalog data", async () => {
    mockPrisma.courseCatalog.upsert.mockResolvedValue({
      id: "course_1",
      slug: "salsa-femenina-matutina",
      title: "Salsa Femenina",
    })

    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "Salsa Femenina Matutina",
        title: "Salsa Femenina",
        kind: "course",
        availableWeekdays: [1, 3, 3],
        availableTimes: ["10:00", "11:00", "11:00", "bad"],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.upsert).toHaveBeenCalled()
    expect(mockPrisma.courseCatalog.upsert.mock.calls[0][0]).toMatchObject({
      where: { slug: "salsa-femenina-matutina" },
    })
  })

  it("POST packages upserts package plan with optional price and credits", async () => {
    mockPrisma.packagePlan.upsert.mockResolvedValue({
      id: "pkg_1",
      key: "morning-3-week",
      label: "Morning 3-week pack",
    })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "morning-3-week",
        courseSlug: "salsa-femenina-matutina",
        label: "Morning 3-week pack",
        priceCents: 14500,
        totalCredits: 15,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.upsert).toHaveBeenCalled()
    expect(mockPrisma.packagePlan.upsert.mock.calls[0][0]).toMatchObject({
      where: { key: "morning-3-week" },
    })
  })

  it("POST points rules upserts points rule", async () => {
    mockPrisma.pointsRule.upsert.mockResolvedValue({
      id: "rule_1",
      key: "profile-completed",
      label: "Perfil completo",
    })

    const { POST } = await import("@/app/api/staff/school/points-rules/route")
    const req = new Request("http://localhost/api/staff/school/points-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "profile-completed",
        label: "Perfil completo",
        eventType: "PROFILE_COMPLETED",
        points: 10,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.pointsRule.upsert).toHaveBeenCalled()
    expect(mockPrisma.pointsRule.upsert.mock.calls[0][0]).toMatchObject({
      where: { key: "profile-completed" },
    })
  })

  it("POST points assign rejects duplicate event key", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u_1",
      email: "ana@example.com",
      name: "Ana",
    })
    mockPrisma.pointsLedger.findFirst.mockResolvedValue({ id: "ledger_1" })

    const { POST } = await import("@/app/api/staff/school/points-assign/route")
    const req = new Request("http://localhost/api/staff/school/points-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: "ana@example.com",
        points: 10,
        eventKey: "profile-completed-u_1",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    expect(mockPrisma.pointsLedger.create).not.toHaveBeenCalled()
  })

  it("POST points assign creates ledger entry and returns updated balance", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u_1",
      email: "ana@example.com",
      name: "Ana",
    })
    mockPrisma.pointsLedger.findFirst.mockResolvedValue(null)
    mockPrisma.pointsLedger.create.mockResolvedValue({ id: "ledger_2" })
    mockPrisma.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 42.5 } })

    const { POST } = await import("@/app/api/staff/school/points-assign/route")
    const req = new Request("http://localhost/api/staff/school/points-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: "ana@example.com",
        points: 12.5,
        type: "MANUAL_STAFF_ASSIGNMENT",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.pointsLedger.create).toHaveBeenCalled()
    const data = await res.json()
    expect(data.pointsBalance).toBe(42.5)
  })
})
