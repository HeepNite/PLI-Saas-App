import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"
import { computeDiscountPercent } from "@/lib/course-links"

export const runtime = "nodejs"

const CHECKIN_TIME_ZONE = "America/New_York"
const WEEKDAY_LABELS_JS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const getJsWeekdayInTimeZone = (date: Date, timeZone: string) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)
  return WEEKDAY_LABELS_JS.findIndex((label) => label === weekday)
}

const toMinutes = (time: string | null | undefined) => {
  if (!time) return null
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const resolveTimesForWeekday = (scheduleRules: unknown, availableTimes: string[], weekday: number) => {
  const parsedRules = parseScheduleRules(scheduleRules)
  const hasDaySpecificRules = Boolean(parsedRules?.rules?.length)
  return {
    hasDaySpecificRules,
    times: getTimesForWeekday(scheduleRules, weekday) ?? (hasDaySpecificRules ? [] : availableTimes),
  }
}

/**
 * GET /api/checkin/terminal/consecutive-offer?courseSlug=<slug>
 *
 * Returns a consecutive class offer for pre-payment step (no auth needed).
 * Looks up an active CourseLink where the given course is courseSlugA,
 * then resolves course B's availability for today.
 *
 * Used by the terminal to show the consecutive offer early in the flow,
 * before the student checks in or authenticates.
 */
export async function GET(req: NextRequest) {
  const courseSlug = req.nextUrl.searchParams.get("courseSlug")
  // TODO: REMOVE - diagnostic
  console.log('[consecutive-offer-api] request received, courseSlug:', courseSlug)
  if (!courseSlug) {
    return NextResponse.json(null)
  }

  try {
    // Find active CourseLink where this course is the first class (A → B)
    const link = await prisma.courseLink.findFirst({
      where: { courseSlugA: courseSlug, active: true },
    })
    if (!link) {
      // TODO: REMOVE - diagnostic
      console.log('[consecutive-offer-api] returning null, reason:', 'no active CourseLink found')
      return NextResponse.json(null)
    }

    const courseA = await prisma.courseCatalog.findUnique({
      where: { slug: courseSlug },
      select: {
        slug: true,
        availableTimes: true,
        scheduleRules: true,
      },
    })

    // Check if course B exists and is active
    let courseB = await prisma.courseCatalog.findUnique({
      where: { slug: link.courseSlugB },
      select: {
        slug: true,
        title: true,
        active: true,
        availableWeekdays: true,
        availableTimes: true,
        scheduleRules: true,
        dropInPriceCents: true,
        durationMinutes: true,
      },
    })

    // Check if course B has class today
    const now = new Date()
    const todayJsWeekday = getJsWeekdayInTimeZone(now, CHECKIN_TIME_ZONE) // 0=Sun, 1=Mon, ... in NY time

    const courseATimesForToday = courseA
      ? resolveTimesForWeekday(courseA.scheduleRules, courseA.availableTimes, todayJsWeekday).times
      : []
    const courseAStartMinutes = toMinutes(courseATimesForToday[0])

    let timesForToday = courseB?.active
      ? resolveTimesForWeekday(courseB.scheduleRules, courseB.availableTimes, todayJsWeekday).times
      : []

    if ((!courseB || !courseB.active || timesForToday.length === 0) && courseAStartMinutes !== null) {
      const candidates = await prisma.courseCatalog.findMany({
        where: {
          active: true,
          slug: { not: courseSlug },
        },
        select: {
          slug: true,
          title: true,
          active: true,
          availableWeekdays: true,
          availableTimes: true,
          scheduleRules: true,
          dropInPriceCents: true,
          durationMinutes: true,
        },
      })

      const nextClass = candidates
        .map((candidate) => {
          const candidateTimes = resolveTimesForWeekday(candidate.scheduleRules, candidate.availableTimes, todayJsWeekday).times
          const firstTime = candidateTimes[0]
          const minutes = toMinutes(firstTime)
          return firstTime && minutes !== null && minutes > courseAStartMinutes
            ? { course: candidate, times: candidateTimes, minutes }
            : null
        })
        .filter((candidate): candidate is { course: NonNullable<typeof courseB>; times: string[]; minutes: number } => Boolean(candidate))
        .sort((left, right) => left.minutes - right.minutes)[0]

      if (nextClass) {
        courseB = nextClass.course
        timesForToday = nextClass.times
      }
    }

    if (!courseB || !timesForToday || timesForToday.length === 0) {
      // TODO: REMOVE - diagnostic
      console.log('[consecutive-offer-api] returning null, reason:', 'no times available for today')
      return NextResponse.json(null)
    }

    // Build the offer
    const regularDropInCents = courseB.dropInPriceCents ?? 0
    const dropInConsecutiveCents = link.dropInConsecutiveCents ?? 0
    const packageHolderConsecutiveCents = link.packageHolderConsecutiveCents ?? 0
    const discountPercent = computeDiscountPercent(regularDropInCents, dropInConsecutiveCents)

    // TODO: REMOVE - diagnostic
    const offer = {
      linkedCourseSlug: courseB.slug,
      linkedCourseTitle: courseB.title,
      linkedCourseTime: timesForToday[0],
      dropInConsecutiveCents,
      packageHolderConsecutiveCents,
      regularDropInCents,
      discountPercent,
      hasAttendedFirstClass: false, // pre-payment — attendance hasn't happened yet
    }
    console.log('[consecutive-offer-api] returning offer:', Boolean(offer))
    return NextResponse.json(offer)
  } catch (err) {
    // TODO: REMOVE - diagnostic
    console.log('[consecutive-offer-api] returning null, reason:', 'uncaught error', err)
    return NextResponse.json(null)
  }
}
