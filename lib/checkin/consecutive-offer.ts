import "server-only"

import { prisma } from "@/lib/prisma"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { computeDiscountPercent } from "@/lib/course-links"
import { hasAttendedCourseToday } from "@/lib/checkin/consecutive-class"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"

export type ConsecutiveOfferResult = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  linkedCourseTime: string | null
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number
  hasAttendedFirstClass: boolean
} | null

type ResolveConsecutiveOfferInput = {
  userId: string
  linkedFromCourseSlug: string
  todayJsWeekday: number
  courseTimeMinutes: number | null
  now?: Date
}

/**
 * Resolve a consecutive offer for a student after they identify at the kiosk.
 *
 * Uses batched DB queries:
 * - Single `courseCatalog.findMany` for all linked course slugs (instead of N×getCatalogCourseBySlug)
 * - Single `hasPurchasesForCoursesToday` (instead of N×hasPurchaseForCourseToday)
 */
export const resolveConsecutiveOffer = async ({
  userId,
  linkedFromCourseSlug,
  todayJsWeekday: _rawWeekday,
  courseTimeMinutes,
  now = new Date(),
}: ResolveConsecutiveOfferInput): Promise<ConsecutiveOfferResult> => {
  // Always derive weekday from ET timezone — server may run in UTC where
  // getDay() returns the wrong day (e.g. Sunday in UTC while still Saturday in ET)
  const ET_DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const todayJsWeekday = ET_DAY_MAP[
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now)
  ] ?? _rawWeekday
  const links = await prisma.courseLink.findMany({
    where: {
      OR: [
        { courseSlugA: linkedFromCourseSlug.toLowerCase() },
        { courseSlugB: linkedFromCourseSlug.toLowerCase() },
      ],
      active: true,
    },
  })

  if (links.length === 0) return null

  const linkedSlugs = links.map((link) =>
    link.courseSlugA === linkedFromCourseSlug.toLowerCase()
      ? link.courseSlugB
      : link.courseSlugA
  )

  const linkedCatalogRows = await prisma.courseCatalog.findMany({
    where: { slug: { in: linkedSlugs } },
    select: {
      slug: true,
      title: true,
      active: true,
      availableTimes: true,
      scheduleRules: true,
      dropInPriceCents: true,
    },
  })

  const hasAttendedA = await hasAttendedCourseToday(userId, linkedFromCourseSlug, now)

  const candidates = links
    .map((link) => {
      const linkedCourseSlug =
        link.courseSlugA === linkedFromCourseSlug.toLowerCase()
          ? link.courseSlugB
          : link.courseSlugA
      const linkedCatalog = linkedCatalogRows.find((row) => row.slug === linkedCourseSlug)
      return { link, linkedCourseSlug, linkedCatalog }
    })
    .filter((c) => c.linkedCatalog)

  const withSchedule = candidates.map((candidate) => {
    const parsedRules = parseScheduleRules(candidate.linkedCatalog?.scheduleRules)
    let linkedStartMinutes: number | null = null
    let isLinkedScheduledToday = true

    if (parsedRules?.rules?.length) {
      const linkedTimesToday =
        getTimesForWeekday(candidate.linkedCatalog?.scheduleRules, todayJsWeekday) ?? []
      const todayTimes = linkedTimesToday
        .map((time) => {
          const match = /^(\d{2}):(\d{2})$/.exec(time)
          if (!match) return null
          return Number(match[1]) * 60 + Number(match[2])
        })
        .filter((minutes): minutes is number => minutes !== null)
        .sort((left, right) => left - right)

      linkedStartMinutes = todayTimes[0] ?? null
      isLinkedScheduledToday = todayTimes.length > 0
    }

    return { ...candidate, linkedStartMinutes, isLinkedScheduledToday }
  })

  // Prefer later-today candidates, but fall back to any scheduled-today candidate.
  // The promo must always appear when a course link exists and the linked course
  // runs today — regardless of class order or prior attendance.
  const nextCandidate = withSchedule
    .filter((c) => c.isLinkedScheduledToday)
    .sort((a, b) => {
      // Prefer classes that are later than the current class
      const aIsLater = a.linkedStartMinutes !== null && courseTimeMinutes !== null && a.linkedStartMinutes > courseTimeMinutes
      const bIsLater = b.linkedStartMinutes !== null && courseTimeMinutes !== null && b.linkedStartMinutes > courseTimeMinutes
      if (aIsLater && !bIsLater) return -1
      if (!aIsLater && bIsLater) return 1
      return (a.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER) - (b.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER)
    })[0]

  if (!nextCandidate?.linkedCatalog) return null

  const linkedCourse = await getCatalogCourseBySlug(nextCandidate.linkedCourseSlug)
  if (!linkedCourse) return null

  const regularDropIn =
    linkedCourse.enrollment.services.find((s) => s.id === "dropin")?.price ?? 0
  const discountPercent = computeDiscountPercent(
    regularDropIn * 100,
    nextCandidate.link.dropInConsecutiveCents
  )

  const linkedCourseTime = nextCandidate.linkedStartMinutes != null
    ? `${String(Math.floor(nextCandidate.linkedStartMinutes / 60)).padStart(2, "0")}:${String(nextCandidate.linkedStartMinutes % 60).padStart(2, "0")}`
    : null

  return {
    linkedCourseSlug: nextCandidate.linkedCourseSlug,
    linkedCourseTitle: nextCandidate.linkedCatalog.title,
    linkedCourseTime,
    dropInConsecutiveCents: nextCandidate.link.dropInConsecutiveCents,
    packageHolderConsecutiveCents: nextCandidate.link.packageHolderConsecutiveCents,
    regularDropInCents: regularDropIn * 100,
    discountPercent,
    hasAttendedFirstClass: hasAttendedA,
  }
}
