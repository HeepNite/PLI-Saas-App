import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCourseCatalogFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseCatalog: {
      findMany: (...args: unknown[]) => mockCourseCatalogFindMany(...args),
    },
  },
}))

describe("GET /api/checkin/terminal/today-classes", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCourseCatalogFindMany.mockReset()
  })

  it("returns courses scheduled for today's weekday", async () => {
    // Tuesday = getDay() = 2
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z")) // Tuesday

    mockCourseCatalogFindMany.mockResolvedValue([
      {
        slug: "salsa-femenina-matutina",
        title: "Salsa Femenina Matutina",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [1, 3], // Mon, Wed — NOT Tuesday
        availableTimes: ["10:00"],
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
        active: true,
        createdAt: new Date(),
      },
      {
        slug: "bachata-nocturna",
        title: "Bachata Nocturna",
        category: "bachata",
        level: "intermediate",
        durationMinutes: 90,
        availableWeekdays: [2, 4], // Tue, Thu — includes Tuesday
        availableTimes: ["20:00", "21:00"],
        dropInPriceCents: 2500,
        firstClassPriceCents: 1200,
        coverImageUrl: "https://example.com/bachata.jpg",
        active: true,
        createdAt: new Date(),
      },
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toHaveLength(1)
    expect(data.classes[0].slug).toBe("bachata-nocturna")
    expect(data.classes[0].availableTimes).toEqual(["20:00", "21:00"])

    vi.useRealTimers()
  })

  it("excludes inactive courses", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z")) // Tuesday

    mockCourseCatalogFindMany.mockResolvedValue([
      {
        slug: "salsa-active",
        title: "Salsa Active",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [2], // Tuesday
        availableTimes: ["10:00"],
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
        active: true,
        createdAt: new Date(),
      },
      {
        slug: "salsa-inactive",
        title: "Salsa Inactive",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [2], // Tuesday
        availableTimes: ["11:00"],
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
        active: false,
        createdAt: new Date(),
      },
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    // Note: the route queries active: true, so inactive courses are excluded at DB level
    // But the mock returns both — the route only filters by active in the query
    // Since we mock the DB response, both come back. The test verifies the route
    // correctly passes active: true to the query.
    expect(mockCourseCatalogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
      })
    )

    vi.useRealTimers()
  })

  it("returns empty array when no courses exist", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z")) // Tuesday

    mockCourseCatalogFindMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toEqual([])
    expect(data.date).toBeDefined()
    expect(data.dayLabel).toBeDefined()

    vi.useRealTimers()
  })

  it("excludes courses with no available times", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z")) // Tuesday

    mockCourseCatalogFindMany.mockResolvedValue([
      {
        slug: "salsa-no-times",
        title: "Salsa No Times",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [2], // Tuesday
        availableTimes: [], // No times
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
        active: true,
        createdAt: new Date(),
      },
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes).toHaveLength(0)

    vi.useRealTimers()
  })

  it("filters out invalid time formats", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z")) // Tuesday

    mockCourseCatalogFindMany.mockResolvedValue([
      {
        slug: "salsa-bad-times",
        title: "Salsa Bad Times",
        category: "salsa",
        level: "beginner",
        durationMinutes: 60,
        availableWeekdays: [2],
        availableTimes: ["10:00", "bad", "20:00"],
        dropInPriceCents: 2000,
        firstClassPriceCents: 1000,
        coverImageUrl: null,
        active: true,
        createdAt: new Date(),
      },
    ])

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.classes[0].availableTimes).toEqual(["10:00", "20:00"])

    vi.useRealTimers()
  })

  it("returns 500 on database error", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockCourseCatalogFindMany.mockRejectedValue(new Error("Database connection failed"))

    const { GET } = await import("@/app/api/checkin/terminal/today-classes/route")
    const res = await GET()

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Unable to fetch today's classes")

    vi.useRealTimers()
  })
})
