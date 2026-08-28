import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockConsumeRateLimit = vi.fn()

const mockPrisma = {
  classSession: {
    findMany: vi.fn(),
  },
  courseCatalog: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperationalRequest(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff:students:sessions:get"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

const getSessions = async (date?: string) => {
  const { GET } = await import("@/app/api/staff/students/sessions/route")
  const query = date ? `?date=${date}` : ""
  return GET(new Request(`http://localhost/api/staff/students/sessions${query}`))
}

describe("GET /api/staff/students/sessions", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.setSystemTime(new Date("2026-05-01T18:30:00.000Z"))

    mockAuthorizeStudentOperationalRequest.mockReset()
    mockConsumeRateLimit.mockReset()
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()

    mockAuthorizeStudentOperationalRequest.mockResolvedValue({
      ok: true,
      userId: "staff_1",
      role: "staff",
      category: "front_desk",
      staffName: "Ana Desk",
    })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
  })

  it("returns auth and rate limit errors before querying sessions", async () => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValueOnce({ ok: false, error: "Unauthorized", status: 401 })

    const unauthorizedRes = await getSessions()

    expect(unauthorizedRes.status).toBe(401)
    await expect(unauthorizedRes.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.courseCatalog.findMany).not.toHaveBeenCalled()

    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 11 })

    const rateLimitedRes = await getSessions()

    expect(rateLimitedRes.status).toBe(429)
    expect(rateLimitedRes.headers.get("Retry-After")).toBe("11")
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.courseCatalog.findMany).not.toHaveBeenCalled()
  })

  it("returns the external selectable session item contract", async () => {
    mockPrisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: "session_current",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-05-01T18:00:00.000Z"),
        durationMinutes: 60,
      },
      {
        id: "session_previous",
        courseSlug: "bachata-open",
        title: null,
        startsAt: new Date("2026-04-30T20:00:00.000Z"),
        durationMinutes: null,
      },
    ])

    const res = await getSessions()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: "session_current",
          courseSlug: "salsa-basics",
          title: "Salsa Basics",
          startsAt: "2026-05-01T18:00:00.000Z",
          durationMinutes: 60,
          isCurrent: true,
        },
        {
          id: "session_previous",
          courseSlug: "bachata-open",
          title: "bachata-open",
          startsAt: "2026-04-30T20:00:00.000Z",
          durationMinutes: null,
          isCurrent: false,
        },
      ],
    })
  })

  it("queries the selectable 14-day window when no date is provided and marks the active session current", async () => {
    mockPrisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: "session_current",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-05-01T18:00:00.000Z"),
        durationMinutes: 60,
      },
      {
        id: "session_recent",
        courseSlug: "zouk-basics",
        title: "Zouk Basics",
        startsAt: new Date("2026-04-20T18:00:00.000Z"),
        durationMinutes: 60,
      },
    ])

    const res = await getSessions()
    const body = await res.json()

    expect(mockPrisma.classSession.findMany).toHaveBeenCalledWith({
      where: {
        startsAt: {
          gte: new Date("2026-04-17T04:00:00.000Z"),
          lt: new Date("2026-05-02T04:00:00.000Z"),
        },
        OR: [
          { specialClass: { is: null } },
          { specialClass: { is: { status: { not: "cancelled" } } } },
        ],
      },
      select: {
        id: true,
        courseSlug: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
      },
      orderBy: { startsAt: "desc" },
      take: 50,
    })
    expect(body.items.map((session: { id: string }) => session.id)).toEqual(["session_current", "session_recent"])
    expect(body.items).toContainEqual(expect.objectContaining({ id: "session_current", isCurrent: true }))
    expect(body.items).toContainEqual(expect.objectContaining({ id: "session_recent", isCurrent: false }))
  })

  it("returns today's scheduled course catalog sessions with synthetic IDs when no date is provided and no class session exists", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])

    const res = await getSessions()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: "scheduled:salsa-basics:2026-05-01:18:00",
          courseSlug: "salsa-basics",
          title: "Salsa Basics",
          startsAt: "2026-05-01T22:00:00.000Z",
          durationMinutes: 60,
          isCurrent: false,
        },
      ],
    })
  })

  it("returns scheduled course catalog sessions with synthetic IDs when no class session exists", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])

    const res = await getSessions("2026-05-01")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: "scheduled:salsa-basics:2026-05-01:18:00",
          courseSlug: "salsa-basics",
          title: "Salsa Basics",
          startsAt: "2026-05-01T22:00:00.000Z",
          durationMinutes: 60,
          isCurrent: false,
        },
      ],
    })
  })

  it("excludes scheduled course catalog sessions when available weekdays do not include the selected JS weekday", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [4],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])

    const res = await getSessions("2026-05-01")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
  })

  it("uses the real class session ID for a scheduled course/time that already exists", async () => {
    mockPrisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: "session_existing",
        courseSlug: "salsa-basics",
        title: "Salsa Basics Live",
        startsAt: new Date("2026-05-01T22:00:00.000Z"),
        durationMinutes: 75,
      },
    ])
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])

    const res = await getSessions("2026-05-01")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: "session_existing",
          courseSlug: "salsa-basics",
          title: "Salsa Basics Live",
          startsAt: "2026-05-01T22:00:00.000Z",
          durationMinutes: 75,
          isCurrent: false,
        },
      ],
    })
  })

  it.each([
    ["future", "2026-05-02"],
    ["too-old historical", "2026-04-16"],
  ])("rejects a %s selected date", async (_label, date) => {
    const res = await getSessions(date)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Date must be today or within the last 14 days." })
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
  })

  it("returns sessions for the requested date and excludes other dates at the query boundary", async () => {
    mockPrisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: "session_prior_day",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-04-30T18:00:00.000Z"),
        durationMinutes: 60,
      },
    ])

    const res = await getSessions("2026-04-30")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        startsAt: {
          gte: new Date("2026-04-30T04:00:00.000Z"),
          lt: new Date("2026-05-01T04:00:00.000Z"),
        },
        OR: [
          { specialClass: { is: null } },
          { specialClass: { is: { status: { not: "cancelled" } } } },
        ],
      },
      select: {
        id: true,
        courseSlug: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
      },
      orderBy: { startsAt: "desc" },
      take: 50,
    }))
    expect(body.items.map((session: { id: string }) => session.id)).toEqual(["session_prior_day"])
  })
})
