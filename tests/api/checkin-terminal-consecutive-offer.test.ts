import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mockCourseLinkFindMany = vi.fn()
const mockCourseCatalogFindUnique = vi.fn()
const mockCourseCatalogFindMany = vi.fn()

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

const buildRequest = (params: Record<string, string>) => {
  const url = new URL("https://app.test/api/checkin/terminal/consecutive-offer")
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url)
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
    vi.useRealTimers()
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

  it("does NOT surface the reverse-direction link (Timba → Beginner) when selected is Beginner on Monday", async () => {
    // Monday 2026-05-18
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-18T22:00:00.000Z"))

    // No links in the A-direction for salsa-night-beginner today
    mockCourseLinkFindMany.mockResolvedValue([])

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

  it("excludes a linked class (later than A) whose end time has already passed relative to now", async () => {
    // Friday 2026-05-22 (NY weekday 5). Rueda is 21:10 + 55min => ends 22:05 NY.
    // Set "now" to 22:10 NY (past the Rueda class's end).
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-23T02:10:00.000Z")) // 22:10 NY Fri

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
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "20:10", date: "2026-05-22" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("still offers a linked class (later than A) that has not yet ended (unchanged)", async () => {
    // Friday 2026-05-22 (NY weekday 5). Rueda is 21:10 + 55min => ends 22:05 NY.
    // Set "now" to 21:30 NY (class in progress, not yet ended).
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-23T01:30:00.000Z")) // 21:30 NY Fri

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
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "20:10", date: "2026-05-22" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      linkedCourseSlug: "salsa-night-advance-beginner-rueda",
      linkedCourseTime: "21:10",
    })
  })

  it("still offers a linked class with null durationMinutes until its start + default duration passes", async () => {
    // Friday 2026-05-22 (NY weekday 5). Rueda starts 21:10 with durationMinutes
    // missing (null), so it must fall back to the default duration (60min)
    // rather than being treated as ending the instant it starts (durationMinutes ?? 0).
    // Default-duration end => 22:10 NY. Set "now" to 21:45 NY (after start, before
    // the default-duration end) — the class must still be offered.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-23T01:45:00.000Z")) // 21:45 NY Fri

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
    mockCourseCatalogFindMany.mockResolvedValue([{ ...ruedaCourse, durationMinutes: null }])

    const { GET } = await import("@/app/api/checkin/terminal/consecutive-offer/route")
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "20:10", date: "2026-05-22" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      linkedCourseSlug: "salsa-night-advance-beginner-rueda",
      linkedCourseTime: "21:10",
    })
  })

  it("does not over-filter a future-dated selectedDate regardless of server TZ", async () => {
    // Server clock set to a real "now" far in the past relative to the
    // requested future date. If resolvedDateIsToday were computed via a
    // locally-parsed Date under a non-UTC server TZ, this could misbehave;
    // comparing the raw selectedDate string against today's NY calendar date
    // keeps this deterministic. Rueda (later than Beginner) on a future
    // Friday must still be offered, unfiltered by "now".
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z")) // real now: long before the future date below

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
    // 2026-05-29 is a future Friday (NY weekday 5) relative to the stubbed "now".
    const res = await GET(buildRequest({ courseSlug: "salsa-night-beginner", time: "20:10", date: "2026-05-29" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      linkedCourseSlug: "salsa-night-advance-beginner-rueda",
      linkedCourseTime: "21:10",
    })
  })
})
