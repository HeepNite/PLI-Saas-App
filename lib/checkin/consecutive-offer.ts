import { prisma } from "@/lib/prisma"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { computeDiscountPercent } from "@/lib/course-links"
import { hasAttendedCourseToday, hasPurchaseForCourseToday } from "@/lib/checkin/consecutive-class"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"

export type ConsecutiveOffer = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number
  hasAttendedFirstClass: boolean
}

export async function resolveConsecutiveOffer(input: {
  linkedFromCourseSlug: string
  userId: string
  currentCourseTime: string | null
  now: Date
}): Promise<ConsecutiveOffer | null> {
  const { linkedFromCourseSlug, userId, currentCourseTime, now } = input

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

  const todayJsWeekday = (() => {
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(now)
    return weekdayLabels.findIndex((label) => label === weekday)
  })()

  const aTimeMatch = /^(\d{2}):(\d{2})$/.exec(currentCourseTime || "")
  const aMinutes = aTimeMatch
    ? Number(aTimeMatch[1]) * 60 + Number(aTimeMatch[2])
    : null

  const candidates = await Promise.all(links.map(async (link) => {
    const linkedCourseSlug = link.courseSlugA === linkedFromCourseSlug.toLowerCase()
      ? link.courseSlugB
      : link.courseSlugA
    const linkedCourse = await getCatalogCourseBySlug(linkedCourseSlug)
    const hasAlreadyLinkedCourse = await hasPurchaseForCourseToday(userId, linkedCourseSlug, now)
    return { link, linkedCourseSlug, linkedCourse, hasAlreadyLinkedCourse }
  }))

  const hasAttendedA = await hasAttendedCourseToday(userId, linkedFromCourseSlug, now)

  const nextCandidate = candidates
    .filter((candidate) => candidate.linkedCourse && !candidate.hasAlreadyLinkedCourse)
    .map((candidate) => {
      const linkedScheduleRules = candidate.linkedCourse?.scheduleRules
      const parsedRules = parseScheduleRules(linkedScheduleRules)
      let linkedStartMinutes: number | null = null
      let isLinkedScheduledLaterToday = true
      if (parsedRules?.rules?.length) {
        const linkedTimesToday = getTimesForWeekday(linkedScheduleRules, todayJsWeekday) ?? []
        const laterTimes = linkedTimesToday
          .map((time) => {
            const match = /^(\d{2}):(\d{2})$/.exec(time)
            if (!match) return null
            const minutes = Number(match[1]) * 60 + Number(match[2])
            return aMinutes === null || minutes > aMinutes ? minutes : null
          })
          .filter((minutes): minutes is number => minutes !== null)
          .sort((left, right) => left - right)
        linkedStartMinutes = laterTimes[0] ?? null
        isLinkedScheduledLaterToday = laterTimes.length > 0
      }
      return { ...candidate, linkedStartMinutes, isLinkedScheduledLaterToday }
    })
    .filter((candidate) => candidate.isLinkedScheduledLaterToday)
    .sort((left, right) => (left.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER) - (right.linkedStartMinutes ?? Number.MAX_SAFE_INTEGER))[0]

  if (!nextCandidate?.linkedCourse || !hasAttendedA) return null

  const regularDropIn = nextCandidate.linkedCourse.enrollment.services.find((s) => s.id === "dropin")?.price ?? 0
  const discountPercent = computeDiscountPercent(
    regularDropIn * 100,
    nextCandidate.link.dropInConsecutiveCents
  )

  return {
    linkedCourseSlug: nextCandidate.linkedCourseSlug,
    linkedCourseTitle: nextCandidate.linkedCourse.title,
    dropInConsecutiveCents: nextCandidate.link.dropInConsecutiveCents,
    packageHolderConsecutiveCents: nextCandidate.link.packageHolderConsecutiveCents,
    regularDropInCents: regularDropIn * 100,
    discountPercent,
    hasAttendedFirstClass: hasAttendedA,
  }
}
