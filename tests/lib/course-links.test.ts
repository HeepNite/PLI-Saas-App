import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCourseLinkFindUnique = vi.fn()
const mockCourseLinkFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseLink: {
      findUnique: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
      findMany: (...args: unknown[]) => mockCourseLinkFindMany(...args),
    },
  },
}))

import { computeDiscountPercent, findConsecutiveLink, findLinkedCourses } from "@/lib/course-links"

// ─── computeDiscountPercent ─────────────────────────────────────

describe("computeDiscountPercent", () => {
  it("returns correct percentage for normal case", () => {
    // regular 1500, consecutive 900 → (1 - 900/1500) * 100 = 40
    expect(computeDiscountPercent(1500, 900)).toBe(40)
  })

  it("returns 0 when regular price is zero", () => {
    expect(computeDiscountPercent(0, 500)).toBe(0)
  })

  it("returns 0 when regular price is null", () => {
    expect(computeDiscountPercent(null as unknown as number, 500)).toBe(0)
  })

  it("returns 0 when regular price is undefined", () => {
    expect(computeDiscountPercent(undefined, 500)).toBe(0)
  })

  it("returns 0 when consecutive price is null", () => {
    expect(computeDiscountPercent(1500, null as unknown as number)).toBe(0)
  })

  it("returns 0 when consecutive price is undefined", () => {
    expect(computeDiscountPercent(1500, undefined)).toBe(0)
  })

  it("returns 0 when regular price is negative", () => {
    expect(computeDiscountPercent(-100, 500)).toBe(0)
  })

  it("returns 0 when regular price is NaN", () => {
    expect(computeDiscountPercent(NaN, 500)).toBe(0)
  })

  it("returns 0 when consecutive price is NaN", () => {
    expect(computeDiscountPercent(1500, NaN)).toBe(0)
  })

  it("returns 0 when consecutive price is zero", () => {
    // consecutive = 0 means 100% off, but the guard checks !consecutivePriceCents (falsy)
    expect(computeDiscountPercent(1500, 0)).toBe(0)
  })

  it("returns 100 when consecutive is half of regular", () => {
    expect(computeDiscountPercent(2000, 1000)).toBe(50)
  })

  it("rounds correctly for non-integer percentages", () => {
    // (1 - 333/1000) * 100 = 66.7 → rounds to 67
    expect(computeDiscountPercent(1000, 333)).toBe(67)
  })

  it("returns 0 when prices are equal (no discount)", () => {
    expect(computeDiscountPercent(1000, 1000)).toBe(0)
  })
})

// ─── findConsecutiveLink ────────────────────────────────────────

describe("findConsecutiveLink", () => {
  beforeEach(() => {
    mockCourseLinkFindUnique.mockReset()
  })

  it("queries with normalized slugs and active filter", async () => {
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      dropInConsecutiveCents: 900,
      packageHolderConsecutiveCents: 500,
      active: true,
    })

    const result = await findConsecutiveLink("Salsa", "Bachata")

    expect(mockCourseLinkFindUnique).toHaveBeenCalledWith({
      where: {
        courseSlugA_courseSlugB: {
          courseSlugA: "salsa",
          courseSlugB: "bachata",
        },
        active: true,
      },
    })
    expect(result).not.toBeNull()
    expect(result?.courseSlugA).toBe("salsa")
  })

  it("returns null when no link exists", async () => {
    mockCourseLinkFindUnique.mockResolvedValue(null)

    const result = await findConsecutiveLink("salsa", "bachata")

    expect(result).toBeNull()
  })

  it("trims and lowercases both slugs", async () => {
    mockCourseLinkFindUnique.mockResolvedValue(null)

    await findConsecutiveLink("  SALSA  ", "  BACHATA  ")

    expect(mockCourseLinkFindUnique).toHaveBeenCalledWith({
      where: {
        courseSlugA_courseSlugB: {
          courseSlugA: "salsa",
          courseSlugB: "bachata",
        },
        active: true,
      },
    })
  })
})

// ─── findLinkedCourses ──────────────────────────────────────────

describe("findLinkedCourses", () => {
  beforeEach(() => {
    mockCourseLinkFindMany.mockReset()
  })

  it("queries both directions with active filter", async () => {
    mockCourseLinkFindMany
      .mockResolvedValueOnce([{ id: "link_1", courseSlugA: "salsa", courseSlugB: "bachata" }])
      .mockResolvedValueOnce([{ id: "link_2", courseSlugA: "bachata", courseSlugB: "salsa" }])

    const result = await findLinkedCourses("salsa")

    expect(mockCourseLinkFindMany).toHaveBeenCalledTimes(2)
    expect(mockCourseLinkFindMany).toHaveBeenNthCalledWith(1, {
      where: { courseSlugA: "salsa", active: true },
      orderBy: [{ createdAt: "asc" }],
    })
    expect(mockCourseLinkFindMany).toHaveBeenNthCalledWith(2, {
      where: { courseSlugB: "salsa", active: true },
      orderBy: [{ createdAt: "asc" }],
    })
    expect(result.asA).toHaveLength(1)
    expect(result.asB).toHaveLength(1)
  })

  it("returns empty arrays when no links exist", async () => {
    mockCourseLinkFindMany.mockResolvedValue([])

    const result = await findLinkedCourses("salsa")

    expect(result.asA).toEqual([])
    expect(result.asB).toEqual([])
  })

  it("normalizes the course slug", async () => {
    mockCourseLinkFindMany.mockResolvedValue([])

    await findLinkedCourses("  SALSA  ")

    expect(mockCourseLinkFindMany).toHaveBeenCalledWith({
      where: { courseSlugA: "salsa", active: true },
      orderBy: [{ createdAt: "asc" }],
    })
  })
})
