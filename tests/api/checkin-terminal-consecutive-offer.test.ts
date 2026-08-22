import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mockCourseLinkFindMany = vi.fn()
const mockCourseCatalogFindUnique = vi.fn()
const mockCourseCatalogFindMany = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseLink: {
      findMany: (...args: unknown[]) => mockCourseLinkFindMany(...args),
    },
    courseCatalog: {
      findUnique: (...args: unknown[]) => mockCourseCatalogFindUnique(...args),
      findMany: (...args: unknown[]) => mockCourseCatalogFindMany(...args),
    },
  },
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

const buildRequest = (params: Record<string, string>, headers?: Record<string, string>) => {
  const url = new URL("https://app.test/api/checkin/terminal/consecutive-offer")
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url, { headers })
}

const beginnerCourse = {
  slug: "salsa-night-beginner",
  title: "Salsa Beginner / Open Level",
  active: true,
  availableWeekdays: [1, 2, 5],
  availableTimes: ["20:10", "21:10"],
  scheduleRules: {
    mode: "regular",
    rules: [
      { weekday: 1, times: ["21:10"] },
      { weekday: 2, times: ["20:10"] },
      { weekday: 5, times: ["20:10"] },
    ],
  },
  dropInPriceCents: 2000,
  durationMinutes: 55,
}

const ruedaCourse = {
  slug: "salsa-night-advance-beginner-rueda",
  title: "Advance Beginner Rueda",
  active: true,
  availableWeekdays: [5],
  availableTimes: ["21:10"],
  scheduleRules: {
    mode: "regular",
    rules: [{ weekday: 5, times: ["21:10"] }],
  },
  dropInPriceCents: 2000,
  durationMinutes: 55,
}

const timbaCourse = {
  slug: "salsa-timba-in-new-york",
  title: "Salsa timba in New York",
  active: true,
  availableWeekdays: [1, 3],
  availableTimes: ["18:00"],
  scheduleRules: {
    mode: "regular",
    rules: [
      { weekday: 1, times: ["18:00"] },
      { weekday: 3, times: ["18:00"] },
    ],
  },
  dropInPriceCents: 2000,
  durationMinutes: 55,
}

describe("GET /api/checkin/terminal/consecutive-offer", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCourseLinkFindMany.mockReset()
    mockCourseCatalogFindUnique.mockReset()
    mockCourseCatalogFindMany.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("203.0.113.10")
    vi.useRealTimers()
  })

  it("returns 429 when the consecutive-offer rate limit is exceeded", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 9 })

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner" }, { "x-forwarded-for": "203.0.113.10" }))

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("9")
    expect(await res.json()).toEqual({ error: "Too many requests. Please try again in a moment." })
  })

  it("returns null when no courseSlug is provided", async () => {
    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({}))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(mockCourseLinkFindMany).not.toHaveBeenCalled()
  })

  it("queries CourseLink on either side and lets today's schedule resolve direction", async () => {
    mockCourseLinkFindMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    await GET(buildRequest({ courseSlug: "salsa-night-beginner" }))

    expect(mockCourseLinkFindMany).toHaveBeenCalledTimes(1)
    const args = mockCourseLinkFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(args.where).toMatchObject({
      active: true,
      OR: [{ courseSlugA: "salsa-night-beginner" }, { courseSlugB: "salsa-night-beginner" }],
    })
  })

  it("does NOT surface a Monday offer for the Rueda link saved as A=beginner B=rueda when Rueda is Fri-only", async () => {
    // Monday 2026-05-18 (NY weekday 1)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-18T22:00:00.000Z")) // 18:00 NY Mon

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        active: true,
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
      },
    ])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([ruedaCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "21:10" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("does NOT surface the reverse-direction link (Timba → Beginner) when selected is Beginner at 20:50", async () => {
    // Monday 2026-05-18
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-19T00:50:00.000Z"))

    mockCourseLinkFindMany.mockResolvedValue([{ courseSlugA: timbaCourse.slug, courseSlugB: beginnerCourse.slug, active: true, dropInConsecutiveCents: 1500, packageHolderConsecutiveCents: 1000 }])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([timbaCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "21:10" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("DOES surface the Monday consecutive offer when selected is Timba 18:00 (A) → Beginner 21:10 (B)", async () => {
    // Monday 2026-05-18
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-18T22:00:00.000Z"))

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-timba-in-new-york",
        courseSlugB: "salsa-night-beginner",
        active: true,
        dropInConsecutiveCents: 1500,
        packageHolderConsecutiveCents: 1000,
      },
    ])
    mockCourseCatalogFindUnique.mockResolvedValue(timbaCourse)
    mockCourseCatalogFindMany.mockResolvedValue([beginnerCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-timba-in-new-york", time: "18:00" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      linkedCourseSlug: "salsa-night-beginner",
      linkedCourseTitle: "Salsa Beginner / Open Level",
      linkedCourseTime: "21:10",
      dropInConsecutiveCents: 1500,
      packageHolderConsecutiveCents: 1000,
    })
  })

  it("DOES surface Friday offer Beginner 20:10 (A) → Rueda 21:10 (B)", async () => {
    // Friday 2026-05-22 (NY weekday 5)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-22T22:00:00.000Z")) // 18:00 NY Fri

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        active: true,
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
      },
    ])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([ruedaCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "20:10" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      linkedCourseSlug: "salsa-night-advance-beginner-rueda",
      linkedCourseTitle: "Advance Beginner Rueda",
      linkedCourseTime: "21:10",
    })
  })

  it("resolves the Tuesday 20:10 → 21:10 offer from schedule data after visual rotation", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-20T00:50:00.000Z")) // 20:50 NY Tue
    const tuesdayAdvanced = {
      ...ruedaCourse,
      slug: "salsa-night-advance-beginner",
      scheduleRules: { mode: "regular", rules: [{ weekday: 2, times: ["21:10"] }] },
    }
    mockCourseLinkFindMany.mockResolvedValue([{
      courseSlugA: beginnerCourse.slug, courseSlugB: tuesdayAdvanced.slug, active: true,
      dropInConsecutiveCents: 1000, packageHolderConsecutiveCents: 1000,
    }])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([tuesdayAdvanced])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: beginnerCourse.slug, date: "2026-05-19", time: "20:10" }))

    expect(await res.json()).toMatchObject({ linkedCourseSlug: tuesdayAdvanced.slug, linkedCourseTime: "21:10" })
  })

  it("returns null when the selected class date is not today in ET", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-22T22:00:00.000Z"))

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        active: true,
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
      },
    ])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", date: "2026-05-23", time: "20:10" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(mockCourseCatalogFindMany).not.toHaveBeenCalled()
  })

  it("returns null when the selected time is not scheduled for the source course today", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-22T22:00:00.000Z"))

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        active: true,
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
      },
    ])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([ruedaCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", date: "2026-05-22", time: "19:10" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("returns null when the linked class has already ended today", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-23T02:10:00.000Z"))

    mockCourseLinkFindMany.mockResolvedValue([
      {
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        active: true,
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
      },
    ])
    mockCourseCatalogFindUnique.mockResolvedValue(beginnerCourse)
    mockCourseCatalogFindMany.mockResolvedValue([ruedaCourse])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", date: "2026-05-22", time: "20:10" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
})
