import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = {
  courseCatalog: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  packagePlan: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

describe("catalog packages are DB-driven", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns DB course with empty packages when no packages exist", async () => {
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      id: "course_1",
      slug: "salsa-nocturno",
      title: "Salsa Night",
      description: null,
      coverImageUrl: null,
      previewVideoUrl: null,
      level: null,
      durationMinutes: 55,
      location: null,
      availableWeekdays: [],
      availableTimes: [],
      dropInPriceCents: 2000,
      firstClassPriceCents: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockPrisma.packagePlan.findMany.mockResolvedValue([])

    const { getCatalogCourseBySlug } = await import("@/lib/catalog-courses")
    const course = await getCatalogCourseBySlug("salsa-nocturno")

    expect(course).not.toBeNull()
    expect(course?.enrollment.packages).toEqual([])
  })

  it("maps DB packages onto course when courseSlugs match exactly", async () => {
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      id: "course_1",
      slug: "salsa-nocturno",
      title: "Salsa Night",
      description: null,
      coverImageUrl: null,
      previewVideoUrl: null,
      level: null,
      durationMinutes: 55,
      location: null,
      availableWeekdays: [],
      availableTimes: [],
      dropInPriceCents: 2000,
      firstClassPriceCents: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockPrisma.packagePlan.findMany.mockResolvedValue([
      {
        id: "pkg_1",
        key: "night-flex",
        label: "Night Flex",
        description: null,
        priceCents: 14500,
        cadence: "2x week",
        status: "ACTIVE",
        launchAt: null,
        totalCredits: 8,
        makeUps: 0,
        validDays: 180,
        isUnlimited: false,
        active: true,
        courseSlugs: ["salsa-nocturno"],
      },
    ])

    const { getCatalogCourseBySlug } = await import("@/lib/catalog-courses")
    const course = await getCatalogCourseBySlug("salsa-nocturno")

    expect(course?.enrollment.packages).toEqual([
      expect.objectContaining({ id: "night-flex", label: "Night Flex", price: 145 }),
    ])
  })

  it("does not mix packages from other courses or global packages into a class", async () => {
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      id: "course_1",
      slug: "salsa-nocturno",
      title: "Salsa Night",
      description: null,
      coverImageUrl: null,
      previewVideoUrl: null,
      level: null,
      durationMinutes: 55,
      location: null,
      availableWeekdays: [],
      availableTimes: [],
      dropInPriceCents: 2000,
      firstClassPriceCents: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockPrisma.packagePlan.findMany.mockResolvedValue([
      {
        id: "pkg_1",
        key: "wrong-course",
        label: "Wrong Course",
        description: null,
        priceCents: 9900,
        cadence: null,
        status: "ACTIVE",
        launchAt: null,
        totalCredits: 5,
        makeUps: 0,
        validDays: 180,
        isUnlimited: false,
        active: true,
        courseSlugs: ["bachata-beginners"],
      },
      {
        id: "pkg_2",
        key: "global-pack",
        label: "Global Pack",
        description: null,
        priceCents: 12000,
        cadence: null,
        status: "ACTIVE",
        launchAt: null,
        totalCredits: 6,
        makeUps: 0,
        validDays: 180,
        isUnlimited: false,
        active: true,
        courseSlugs: [],
      },
    ])

    const { getCatalogCourseBySlug } = await import("@/lib/catalog-courses")
    const course = await getCatalogCourseBySlug("salsa-nocturno")

    expect(course?.enrollment.packages).toEqual([])
  })

  it("returns DB packages only for dynamic course rows", async () => {
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      id: "course_1",
      slug: "salsa-nocturno",
      title: "Salsa Night",
      kind: "course",
      category: null,
      description: null,
      coverImageUrl: null,
      previewVideoUrl: null,
      level: null,
      durationMinutes: 55,
      location: null,
      availableWeekdays: [],
      availableTimes: [],
      dropInPriceCents: 2000,
      firstClassPriceCents: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockPrisma.packagePlan.findMany.mockResolvedValue([])

    const { getCatalogCourseBySlug } = await import("@/lib/catalog-courses")
    const course = await getCatalogCourseBySlug("salsa-nocturno")

    expect(course).not.toBeNull()
    expect(course?.enrollment.packages).toEqual([])
  })

  it("retries package lookup without lifecycle filter when Prisma runtime rejects status field", async () => {
    const lifecycleValidationError = Object.assign(
      new Error("Unknown argument `status` in prisma.packagePlan.findMany() invocation"),
      { name: "PrismaClientValidationError" }
    )

    mockPrisma.courseCatalog.findUnique.mockResolvedValue({
      id: "course_1",
      slug: "salsa-nocturno",
      title: "Salsa Night",
      kind: "course",
      category: null,
      description: null,
      coverImageUrl: null,
      previewVideoUrl: null,
      level: null,
      durationMinutes: 55,
      location: null,
      availableWeekdays: [],
      availableTimes: [],
      dropInPriceCents: 2000,
      firstClassPriceCents: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockPrisma.packagePlan.findMany
      .mockRejectedValueOnce(lifecycleValidationError)
      .mockResolvedValueOnce([
        {
          id: "pkg_1",
          key: "night-flex",
          label: "Night Flex",
          description: null,
          priceCents: 14500,
          cadence: "2x week",
          totalCredits: 8,
          makeUps: 0,
          validDays: 180,
          isUnlimited: false,
          active: true,
          courseSlugs: ["salsa-nocturno"],
        },
      ])

    const { getCatalogCourseBySlug } = await import("@/lib/catalog-courses")
    const course = await getCatalogCourseBySlug("salsa-nocturno")

    expect(mockPrisma.packagePlan.findMany).toHaveBeenCalledTimes(2)
    // Fallback query uses courseSlugs with has operator (no course filter in fallback)
    expect(mockPrisma.packagePlan.findMany.mock.calls[1][0]).toEqual({
      where: {
        active: true,
        courseSlugs: { has: "salsa-nocturno" },
      },
      orderBy: [{ createdAt: "desc" }],
    })
    expect(course?.enrollment.packages).toEqual([
      expect.objectContaining({ id: "night-flex", label: "Night Flex", price: 145 }),
    ])
  })

  it("returns courses from DB with empty packages when no packages exist", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        id: "course_1",
        slug: "salsa-nocturno",
        title: "Salsa Night",
        description: null,
        coverImageUrl: null,
        previewVideoUrl: null,
        level: null,
        durationMinutes: 55,
        location: null,
        availableWeekdays: [],
        availableTimes: [],
        dropInPriceCents: 2000,
        firstClassPriceCents: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    mockPrisma.packagePlan.findMany.mockResolvedValue([])

    const { getCatalogFrontData } = await import("@/lib/catalog-courses")
    const data = await getCatalogFrontData()

    expect(data.courses.length).toBeGreaterThan(0)
    expect(data.courses.every((course) => course.enrollment.packages.length === 0)).toBe(true)
  })

  it("maps DB packages onto courses without cross-course mixing", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        id: "course_1",
        slug: "salsa-nocturno",
        title: "Salsa Night",
        description: null,
        coverImageUrl: null,
        previewVideoUrl: null,
        level: null,
        durationMinutes: 55,
        location: null,
        availableWeekdays: [],
        availableTimes: [],
        dropInPriceCents: 2000,
        firstClassPriceCents: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "course_2",
        slug: "bachata-beginners",
        title: "Bachata Beginners",
        description: null,
        coverImageUrl: null,
        previewVideoUrl: null,
        level: null,
        durationMinutes: 55,
        location: null,
        availableWeekdays: [],
        availableTimes: [],
        dropInPriceCents: 2000,
        firstClassPriceCents: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    mockPrisma.packagePlan.findMany.mockResolvedValue([
      {
        id: "pkg_1",
        key: "night-flex",
        label: "Night Flex",
        description: null,
        priceCents: 14500,
        cadence: "2x week",
        status: "ACTIVE",
        launchAt: null,
        totalCredits: 8,
        makeUps: 0,
        validDays: 180,
        isUnlimited: false,
        active: true,
        courseSlugs: ["salsa-nocturno"],
      },
      {
        id: "pkg_2",
        key: "bachata-pack",
        label: "Bachata Pack",
        description: null,
        priceCents: 13000,
        cadence: null,
        status: "ACTIVE",
        launchAt: null,
        totalCredits: 6,
        makeUps: 0,
        validDays: 180,
        isUnlimited: false,
        active: true,
        courseSlugs: ["bachata-beginners"],
      },
    ])

    const { getCatalogFrontData } = await import("@/lib/catalog-courses")
    const data = await getCatalogFrontData()
    const salsaNight = data.courses.find((course) => course.slug === "salsa-nocturno")

    expect(salsaNight?.enrollment.packages).toEqual([
      expect.objectContaining({ id: "night-flex", label: "Night Flex" }),
    ])
    expect(salsaNight?.enrollment.packages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "bachata-pack" })])
    )
  })
})
