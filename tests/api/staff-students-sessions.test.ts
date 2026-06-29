import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockConsumeRateLimit = vi.fn()

const mockPrisma = {
  classSession: {
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

const getSessions = async () => {
  const { GET } = await import("@/app/api/staff/students/sessions/route")
  return GET(new Request("http://localhost/api/staff/students/sessions"))
}

describe("GET /api/staff/students/sessions", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.setSystemTime(new Date("2026-05-01T18:30:00.000Z"))

    mockAuthorizeStudentOperationalRequest.mockReset()
    mockConsumeRateLimit.mockReset()
    mockPrisma.classSession.findMany.mockReset()

    mockAuthorizeStudentOperationalRequest.mockResolvedValue({
      ok: true,
      userId: "staff_1",
      role: "staff",
      category: "front_desk",
      staffName: "Ana Desk",
    })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
  })

  it("returns auth and rate limit errors before querying sessions", async () => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValueOnce({ ok: false, error: "Unauthorized", status: 401 })

    const unauthorizedRes = await getSessions()

    expect(unauthorizedRes.status).toBe(401)
    await expect(unauthorizedRes.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()

    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 11 })

    const rateLimitedRes = await getSessions()

    expect(rateLimitedRes.status).toBe(429)
    expect(rateLimitedRes.headers.get("Retry-After")).toBe("11")
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
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

  it("queries only the selectable window and marks the active session current", async () => {
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
          gte: new Date("2026-04-17T18:30:00.000Z"),
          lte: new Date("2026-05-02T18:30:00.000Z"),
        },
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
})
