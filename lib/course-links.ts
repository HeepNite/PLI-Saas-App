import "server-only"

import type { CourseLink } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// ─── CourseLink query helpers ─────────────────────────────────

/**
 * Find an active CourseLink between two courses (directed: A → B).
 * Returns null if no active link exists for the given pair.
 */
export const findConsecutiveLink = async (
  courseSlugA: string,
  courseSlugB: string
): Promise<CourseLink | null> => {
  return prisma.courseLink.findUnique({
    where: {
      courseSlugA_courseSlugB: {
        courseSlugA: courseSlugA.trim().toLowerCase(),
        courseSlugB: courseSlugB.trim().toLowerCase(),
      },
      active: true,
    },
  })
}

/**
 * Find all active courses linked to a given course, regardless of direction.
 * Returns two arrays:
 * - `asA`: courses where the given slug is courseSlugA (links where this is the early class)
 * - `asB`: courses where the given slug is courseSlugB (links where this is the consecutive class)
 */
export const findLinkedCourses = async (courseSlug: string): Promise<{
  asA: CourseLink[]
  asB: CourseLink[]
}> => {
  const normalized = courseSlug.trim().toLowerCase()

  const [asA, asB] = await Promise.all([
    prisma.courseLink.findMany({
      where: { courseSlugA: normalized, active: true },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.courseLink.findMany({
      where: { courseSlugB: normalized, active: true },
      orderBy: [{ createdAt: "asc" }],
    }),
  ])

  return { asA, asB }
}

// ─── Discount computation ─────────────────────────────────────

/**
 * Compute the discount percentage between a regular price and a consecutive price.
 * Returns an integer percentage (e.g., 40 for 40% off).
 *
 * Guards against null/zero/invalid inputs to prevent division by zero.
 * Returns 0 when the discount cannot be computed.
 */
export const computeDiscountPercent = (
  regularPriceCents: number | null | undefined,
  consecutivePriceCents: number | null | undefined
): number => {
  if (
    !regularPriceCents ||
    !consecutivePriceCents ||
    !Number.isFinite(regularPriceCents) ||
    !Number.isFinite(consecutivePriceCents) ||
    regularPriceCents <= 0
  ) {
    return 0
  }

  return Math.round((1 - consecutivePriceCents / regularPriceCents) * 100)
}
