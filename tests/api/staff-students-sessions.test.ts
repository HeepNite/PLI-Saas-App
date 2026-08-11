import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorize = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockFindMany = vi.fn()
const mockFindCourses = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorize(...args),
}))
vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff:students:sessions:get:127.0.0.1"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))
vi.mock("@/lib/prisma", () => ({ prisma: {
  classSession: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  courseCatalog: { findMany: (...args: unknown[]) => mockFindCourses(...args) },
} }))

const getSessions = async (date: string) => {
  const { GET } = await import("@/app/api/staff/students/sessions/route")
  return GET(new Request(`http://localhost/api/staff/students/sessions?date=${date}`))
}

describe("GET /api/staff/students/sessions", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorize.mockReset().mockResolvedValue({ ok: true, userId: "staff_1", role: "staff", category: "front_desk", staffName: "Ana" })
    mockConsumeRateLimit.mockReset().mockReturnValue({ ok: true })
    mockFindMany.mockReset().mockResolvedValue([{ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: new Date("2026-07-15T23:00:00.000Z"), durationMinutes: 60 }])
    mockFindCourses.mockReset().mockResolvedValue([])
  })

  it("returns persisted sessions for the inclusive 14-day boundary", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    try {
      const res = await getSessions("2026-07-15")
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ items: [{ id: "session_1", startsAt: "2026-07-15T23:00:00.000Z" }] })
    } finally { vi.useRealTimers() }
  })

  it.each(["2026-07-14", "2026-07-30", "2026-02-30"]) ("rejects unavailable date %s", async (date) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    try {
      expect((await getSessions(date)).status).toBe(400)
      expect(mockFindMany).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it("preserves operational authorization and read rate limiting", async () => {
    mockAuthorize.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    expect((await getSessions("2026-07-29")).status).toBe(403)
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 9 })
    const res = await getSessions("2026-07-29")
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("9")
  })

  it("derives a scheduled catalog session when no persisted session exists", async () => {
    mockFindMany.mockResolvedValue([])
    mockFindCourses.mockResolvedValue([{
      slug: "salsa", title: "Salsa", durationMinutes: 60,
      availableWeekdays: [3], availableTimes: ["19:00"], scheduleRules: null,
    }])

    const res = await getSessions("2026-07-29")

    await expect(res.json()).resolves.toEqual({ items: [{
      id: "scheduled:salsa:2026-07-29:19:00", courseSlug: "salsa", title: "Salsa",
      startsAt: "2026-07-29T23:00:00.000Z", durationMinutes: 60, isCurrent: false,
    }] })
  })

  it("uses a persisted session in preference to the matching catalog schedule", async () => {
    mockFindMany.mockResolvedValue([{ id: "session_persisted", courseSlug: "salsa", title: "Live Salsa", startsAt: new Date("2026-07-29T23:00:00.000Z"), durationMinutes: 75 }])
    mockFindCourses.mockResolvedValue([{
      slug: "salsa", title: "Salsa", durationMinutes: 60,
      availableWeekdays: [3], availableTimes: ["19:00"], scheduleRules: null,
    }])

    const res = await getSessions("2026-07-29")

    await expect(res.json()).resolves.toEqual({ items: [expect.objectContaining({ id: "session_persisted", title: "Live Salsa", durationMinutes: 75 })] })
  })

  it("uses the New York calendar date at the UTC day boundary", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T03:30:00.000Z"))
    mockFindMany.mockResolvedValue([])
    mockFindCourses.mockResolvedValue([{
      slug: "salsa", title: "Salsa", durationMinutes: 60,
      availableWeekdays: [2], availableTimes: ["19:00"], scheduleRules: null,
    }])
    try {
      const res = await getSessions("2026-07-28")
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ items: [expect.objectContaining({ id: "scheduled:salsa:2026-07-28:19:00" })] })
    } finally { vi.useRealTimers() }
  })
})
