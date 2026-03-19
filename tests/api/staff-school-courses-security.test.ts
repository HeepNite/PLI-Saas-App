import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockGetClientIp = vi.fn()

const mockPrisma = {
  courseCatalog: {
    upsert: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff school courses route security", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockConsumeRateLimit.mockReset()
    mockGetClientIp.mockReset()
    mockPrisma.courseCatalog.upsert.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockBuildRateLimitKey.mockReturnValue("rl-key")
    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockPrisma.courseCatalog.upsert.mockResolvedValue({ id: "course_1", slug: "safe-course", title: "Safe course" })
  })

  it("returns 429 when POST rate limit is exceeded", async () => {
    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 15 })
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "abc", title: "Course" }),
      })
    )
    expect(res.status).toBe(429)
  })

  it("rejects slug shorter than 3 chars after normalization", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "$$", title: "Course" }),
      })
    )
    expect(res.status).toBe(400)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("rejects course payload without title", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "salsa-morning", title: "" }),
      })
    )
    expect(res.status).toBe(400)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("sanitizes and persists normalized schedule/security fields", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "  Salsa <script>alert(1)</script> Night  ",
        title: " Salsa Night  ",
        kind: "course",
        availableWeekdays: [1, 1, 8, -1, "wed"],
        availableTimes: ["09:00", "09:00", "AA:11", "17:30"],
        scheduleRules: {
          mode: "regular",
          weeklyDaysTarget: 99,
          repeatAllMonth: false,
          recurrenceMode: "until_date",
          recurrenceEndsAt: "2026-12-01",
          rules: [
            { weekday: 1, times: ["09:00", "09:00", "99:99"] },
            { weekday: 9, times: ["10:00"] },
          ],
          specialEvents: [
            { date: "2026-10-10", times: ["17:30", "17:30"], label: "ignored" },
            { date: "not-date", times: ["10:00"] },
          ],
          publication: { mode: "launch_date", launchDate: "2026-11-11" },
          specialDiscount: { type: "custom", label: "  Holiday deal ", priceCents: 1234.9 },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.upsert).toHaveBeenCalledTimes(1)

    const call = mockPrisma.courseCatalog.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ slug: "salsa-script-alert-1-script-night" })
    expect(call.create.availableWeekdays).toEqual([1])
    expect(call.create.availableTimes).toEqual(["09:00", "17:30"])
    expect(call.create.scheduleRules).toMatchObject({
      mode: "regular",
      weeklyDaysTarget: 7,
      repeatAllMonth: false,
      recurrenceMode: "until_date",
      recurrenceEndsAt: "2026-12-01",
      rules: [{ weekday: 1, times: ["09:00"] }],
      specialEvents: [{ date: "2026-10-10", times: ["17:30"], label: "Special event" }],
      publication: { mode: "launch_date", launchDate: "2026-11-11" },
      specialDiscount: { type: "custom", label: "Holiday deal", priceCents: 1235 },
    })
  })
})

