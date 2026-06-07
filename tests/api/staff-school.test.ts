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
    update: vi.fn(),
  },
  pointsRule: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  room: {
    findUnique: vi.fn(),
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
    mockPrisma.packagePlan.update.mockReset()
    mockPrisma.pointsRule.findMany.mockReset()
    mockPrisma.pointsRule.upsert.mockReset()
    mockPrisma.room.findUnique.mockReset()
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.pointsLedger.findFirst.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockPrisma.pointsLedger.aggregate.mockReset()

    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.packagePlan.findMany.mockResolvedValue([])
    mockPrisma.pointsRule.findMany.mockResolvedValue([])
    mockPrisma.room.findUnique.mockResolvedValue(null)
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
      title: "Salsa Feminine Style",
    })

    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "Salsa Feminine Morning",
        title: "Salsa Feminine Style",
        kind: "course",
        availableWeekdays: [1, 3, 3],
        availableTimes: ["10:00", "11:00", "11:00", "bad"],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.upsert).toHaveBeenCalled()
    expect(mockPrisma.courseCatalog.upsert.mock.calls[0][0]).toMatchObject({
      where: { slug: "salsa-feminine-morning" },
    })
  })

  it("POST courses persists an active defaultRoomId", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "123e4567-e89b-42d3-a456-426614174000", active: true })
    mockPrisma.courseCatalog.upsert.mockResolvedValue({
      id: "course_room_1",
      slug: "salsa-room-course",
      title: "Salsa Room Course",
      defaultRoomId: "123e4567-e89b-42d3-a456-426614174000",
    })

    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "salsa-room-course",
        title: "Salsa Room Course",
        defaultRoomId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
      where: { id: "123e4567-e89b-42d3-a456-426614174000" },
      select: { id: true, active: true },
    })
    expect(mockPrisma.courseCatalog.upsert.mock.calls[0][0]).toMatchObject({
      create: { defaultRoomId: "123e4567-e89b-42d3-a456-426614174000" },
      update: { defaultRoomId: "123e4567-e89b-42d3-a456-426614174000" },
    })
  })

  it("POST courses rejects inactive default rooms", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "123e4567-e89b-42d3-a456-426614174000", active: false })

    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "salsa-room-course",
        title: "Salsa Room Course",
        defaultRoomId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(404)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Default room not found or inactive." })
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

  it("POST packages updates an existing package by id so the key can be renamed", async () => {
    mockPrisma.packagePlan.update = vi.fn().mockResolvedValue({
      id: "pkg_existing",
      key: "evening-pro",
      label: "Evening Pro",
      courseSlugs: ["salsa-nocturno"],
    })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "pkg_existing",
        key: "evening-pro",
        courseSlugs: ["salsa-nocturno"],
        label: "Evening Pro",
        priceCents: 95,
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.update).toHaveBeenCalledWith({
      where: { id: "pkg_existing" },
      data: expect.objectContaining({
        key: "evening-pro",
        courseSlugs: ["salsa-nocturno"],
        label: "Evening Pro",
        priceCents: 95,
      }),
    })
    expect(mockPrisma.packagePlan.upsert).not.toHaveBeenCalled()
  })

  it("GET packages supports filtering inactive visibility", async () => {
    mockPrisma.packagePlan.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/school/packages/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages?active=false"))

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.findMany).toHaveBeenCalledWith({
      where: { active: false },
      orderBy: [{ createdAt: "desc" }],
    })
  })

  it("GET packages supports filtering by lifecycle status", async () => {
    mockPrisma.packagePlan.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/school/packages/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages?status=SCHEDULED"))

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.findMany).toHaveBeenCalledWith({
      where: { status: "SCHEDULED" },
      orderBy: [{ createdAt: "desc" }],
    })
  })

  it("POST packages accepts decimal price input and preserves informational cadence", async () => {
    mockPrisma.packagePlan.upsert.mockResolvedValue({
      id: "pkg_2",
      key: "night-pack",
      label: "Night pack",
    })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "night-pack",
        courseSlug: "salsa-night",
        label: "Night pack",
        priceCents: "145.50",
        cadence: "3/week",
        totalCredits: 12,
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.upsert).toHaveBeenCalled()
    expect(mockPrisma.packagePlan.upsert.mock.calls[0][0]).toMatchObject({
      create: expect.objectContaining({
        priceCents: 14550,
        cadence: "3/week",
      }),
      update: expect.objectContaining({
        priceCents: 14550,
        cadence: "3/week",
      }),
    })
  })

  it("POST packages stores scheduled lifecycle with launch date and keeps active false", async () => {
    mockPrisma.packagePlan.upsert.mockResolvedValue({
      id: "pkg_sched",
      key: "night-pack-launch",
      label: "Night pack launch",
    })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "night-pack-launch",
        courseSlug: "salsa-night",
        label: "Night pack launch",
        status: "SCHEDULED",
        launchAt: "2026-05-01T10:00:00.000Z",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.upsert.mock.calls[0][0]).toMatchObject({
      create: expect.objectContaining({
        status: "SCHEDULED",
        active: false,
      }),
      update: expect.objectContaining({
        status: "SCHEDULED",
        active: false,
      }),
    })
  })

  it("POST packages falls back to active-only persistence when Prisma runtime rejects lifecycle fields", async () => {
    const lifecycleValidationError = Object.assign(new Error("Unknown argument `status` in prisma.packagePlan.upsert() invocation"), {
      name: "PrismaClientValidationError",
    })

    mockPrisma.packagePlan.upsert
      .mockRejectedValueOnce(lifecycleValidationError)
      .mockResolvedValueOnce({
        id: "pkg_compat",
        key: "night-flex",
        label: "Night Flex",
        active: false,
      })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "night-flex",
        label: "Night Flex",
        status: "DELETED",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.upsert).toHaveBeenCalledTimes(2)
    expect(mockPrisma.packagePlan.upsert.mock.calls[1][0]).toMatchObject({
      create: expect.not.objectContaining({ status: expect.anything(), launchAt: expect.anything() }),
      update: expect.not.objectContaining({ status: expect.anything(), launchAt: expect.anything() }),
    })
    await expect(res.json()).resolves.toMatchObject({
      item: expect.objectContaining({
        key: "night-flex",
        status: "DELETED",
        active: false,
      }),
    })
  })

  it("POST packages updates by id even when lifecycle fields are rejected by Prisma runtime", async () => {
    const lifecycleValidationError = Object.assign(new Error("Unknown argument `status` in prisma.packagePlan.update() invocation"), {
      name: "PrismaClientValidationError",
    })

    mockPrisma.packagePlan.update = vi
      .fn()
      .mockRejectedValueOnce(lifecycleValidationError)
      .mockResolvedValueOnce({
        id: "pkg_existing",
        key: "evening-pro",
        label: "Evening Pro",
        active: false,
      })

    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "pkg_existing",
        key: "evening-pro",
        label: "Evening Pro",
        status: "DELETED",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.packagePlan.update.mock.calls[1][0]).toMatchObject({
      where: { id: "pkg_existing" },
      data: expect.not.objectContaining({ status: expect.anything(), launchAt: expect.anything() }),
    })
  })

  it("GET packages falls back to active filter when Prisma runtime rejects status filter", async () => {
    const lifecycleValidationError = Object.assign(new Error("Unknown argument `status` in prisma.packagePlan.findMany() invocation"), {
      name: "PrismaClientValidationError",
    })

    mockPrisma.packagePlan.findMany
      .mockRejectedValueOnce(lifecycleValidationError)
      .mockResolvedValueOnce([{ id: "pkg_compat", key: "night-flex", label: "Night Flex", active: false }])

    const { GET } = await import("@/app/api/staff/school/packages/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages?status=SUSPENDED"))

    expect(res.status).toBe(200)
    expect(mockPrisma.packagePlan.findMany.mock.calls[1][0]).toEqual({
      where: { active: false },
      orderBy: [{ createdAt: "desc" }],
    })
    await expect(res.json()).resolves.toMatchObject({
      items: [expect.objectContaining({ key: "night-flex", status: "SUSPENDED", active: false })],
    })
  })

  it("POST packages rejects scheduled lifecycle without launch date", async () => {
    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "night-pack-launch",
        label: "Night pack launch",
        status: "SCHEDULED",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mockPrisma.packagePlan.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Scheduled packages require a launch date." })
  })

  it("POST packages rejects malformed decimal price input", async () => {
    const { POST } = await import("@/app/api/staff/school/packages/route")
    const req = new Request("http://localhost/api/staff/school/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "night-pack",
        label: "Night pack",
        priceCents: "145.509",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mockPrisma.packagePlan.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({
      error: "Package price must use up to 2 decimals (example: 145.50).",
    })
  })

  it("POST points rules upserts points rule", async () => {
    mockPrisma.pointsRule.upsert.mockResolvedValue({
      id: "rule_1",
      key: "profile-completed",
      label: "Complete profile",
    })

    const { POST } = await import("@/app/api/staff/school/points-rules/route")
    const req = new Request("http://localhost/api/staff/school/points-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "profile-completed",
        label: "Complete profile",
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
