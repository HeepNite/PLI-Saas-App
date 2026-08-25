import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCourseCatalogFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseCatalog: {
      findMany: (...args: unknown[]) => mockCourseCatalogFindMany(...args),
    },
  },
}))

const TODAY_CLASSES_URL = "http://localhost/api/checkin/terminal/today-classes"

const createCourse = (overrides: Partial<Record<string, unknown>> = {}) => ({
  slug: "bachata-nocturna",
  title: "Bachata Nocturna",
  category: "bachata",
  level: "intermediate",
  durationMinutes: 90,
  availableWeekdays: [2, 4],
  availableTimes: ["20:00", "21:00"],
  scheduleRules: null,
  dropInPriceCents: 2500,
  firstClassPriceCents: 1200,
  coverImageUrl: "https://example.com/bachata.jpg",
  active: true,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides,
})

const createRequest = () => new Request(TODAY_CLASSES_URL) as unknown as import("next/server").NextRequest

const resetNestGatewayEnv = () => {
  delete process.env.NEST_GATEWAY_ENABLED
  delete process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED
  delete process.env.NEST_BACKEND_INTERNAL_URL
  delete process.env.NEST_GATEWAY_SHARED_SECRET
}

describe("GET /api/checkin/terminal/today-classes", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    mockCourseCatalogFindMany.mockReset()
    resetNestGatewayEnv()
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetNestGatewayEnv()
    consoleInfoSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it("returns courses scheduled for today's weekday", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockResolvedValue([
      createCourse({
        slug: "salsa-femenina-matutina",
        title: "Salsa Femenina Matutina",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [1, 3],
        availableTimes: ["10:00"],
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
      }),
      createCourse(),
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toHaveLength(1)
    expect(data.classes[0].slug).toBe("bachata-nocturna")
    expect(data.classes[0].availableTimes).toEqual(["20:00", "21:00"])
  })

  it("excludes inactive courses", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockResolvedValue([
      createCourse({ slug: "salsa-active", title: "Salsa Active", category: "salsa", level: "beginner", durationMinutes: 60, availableTimes: ["10:00"], dropInPriceCents: 2000, firstClassPriceCents: 1000, coverImageUrl: null }),
      createCourse({ slug: "salsa-inactive", title: "Salsa Inactive", category: "salsa", level: "beginner", durationMinutes: 60, availableTimes: ["11:00"], dropInPriceCents: 2000, firstClassPriceCents: 1000, coverImageUrl: null, active: false }),
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    await res.json()
    expect(mockCourseCatalogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
      })
    )
  })

  it("returns empty array when no courses exist", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toEqual([])
    expect(data.date).toBeDefined()
    expect(data.dayLabel).toBeDefined()
  })

  it("excludes courses with no available times", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockResolvedValue([
      createCourse({ slug: "salsa-no-times", title: "Salsa No Times", category: "salsa", level: "beginner", durationMinutes: 60, availableTimes: [], dropInPriceCents: 2000, firstClassPriceCents: 1000, coverImageUrl: null }),
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toHaveLength(0)
  })

  it("filters out invalid time formats", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockResolvedValue([
      createCourse({ slug: "salsa-bad-times", title: "Salsa Bad Times", category: "salsa", level: "beginner", durationMinutes: 60, availableTimes: ["10:00", "bad", "20:00"], dropInPriceCents: 2000, firstClassPriceCents: 1000, coverImageUrl: null }),
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes[0].availableTimes).toEqual(["10:00", "20:00"])
  })

  it("returns 500 on database error", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockRejectedValue(new Error("Database connection failed"))

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Unable to fetch today's classes")
  })

  it("delegates to Nest when the today-classes route flag is enabled and keeps the public response contract", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "local-fallback" })])

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const nestPayload = {
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "nest-proof",
          title: "Nest Proof",
          category: "salsa",
          level: "advanced",
          durationMinutes: 75,
          availableTimes: ["18:30"],
          dayLabel: "Tue",
          dropInPriceCents: 3200,
          firstClassPriceCents: 1500,
          coverImageUrl: null,
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(nestPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(nestPayload)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://nest.internal/internal/checkin/today-classes",
      expect.objectContaining({
        cache: "no-store",
        method: "GET",
      })
    )
  })

  it("strips unexpected Nest fields before returning the public today-classes contract", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "local-fallback" })])

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          date: getDateKeyForTerminal(now),
          weekday: 1,
          dayLabel: "Tue",
          source: "nest",
          classes: [
            {
              slug: "nest-proof",
              title: "Nest Proof",
              category: "salsa",
              level: "advanced",
              durationMinutes: 75,
              availableTimes: ["18:30"],
              dayLabel: "Tue",
              dropInPriceCents: 3200,
              firstClassPriceCents: 1500,
              coverImageUrl: null,
              internalNotes: "do not leak",
            },
          ],
          traceId: "trace-123",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "nest-proof",
          title: "Nest Proof",
          category: "salsa",
          level: "advanced",
          durationMinutes: 75,
          availableTimes: ["18:30"],
          dayLabel: "Tue",
          dropInPriceCents: 3200,
          firstClassPriceCents: 1500,
          coverImageUrl: null,
        },
      ],
    })
  })

  it("falls back to the current Next implementation when Nest returns a malformed success payload", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "next-fallback-malformed" })])

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ date: now.toISOString(), weekday: 1, dayLabel: "Tue", classes: [{ slug: 42 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "next-fallback-malformed",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })

  it("keeps the current Next implementation when the route-specific Nest flag is off", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse()])

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "bachata-nocturna",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to the current Next implementation when Nest is unavailable", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "next-fallback" })])

    const fetchMock = vi.fn().mockRejectedValue(new Error("socket hang up"))
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "next-fallback",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })

  it.each([401, 403])("falls back to the current Next implementation when Nest returns %i", async (status) => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: `next-fallback-${status}` })])

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: "unauthorized upstream details",
        message: "do not leak",
        traceId: `trace-${status}`,
        source: "nest",
      }), { status })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: `next-fallback-${status}`,
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })

  it("falls back to the current Next implementation when Nest returns a non-ok upstream error", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "next-fallback-upstream-error" })])

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: "bad gateway",
        details: "nested stack trace",
        classes: [{ slug: "should-not-leak" }],
        traceId: "trace-502",
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET(createRequest())

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "next-fallback-upstream-error",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })

  it("falls back to the current Next implementation when the Nest today-classes request times out", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-03-24T16:00:00.000Z")
    vi.setSystemTime(now)

    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_TODAY_CLASSES_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"
    process.env.NEST_GATEWAY_TIMEOUT_MS = "5"

    mockCourseCatalogFindMany.mockResolvedValue([createCourse({ slug: "next-fallback-timeout" })])

    const fetchMock: typeof fetch = vi.fn((_: string | URL | Request, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        })
      })
    ) as typeof fetch
    vi.stubGlobal("fetch", fetchMock)

    const { getDateKeyForTerminal } = await import("@/lib/checkin/terminal-current-class")
    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const pending = GET(createRequest())

    await vi.advanceTimersByTimeAsync(5)
    const res = await pending

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      date: getDateKeyForTerminal(now),
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "next-fallback-timeout",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })
})
