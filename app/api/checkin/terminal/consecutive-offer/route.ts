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
  const selectedTime = req.nextUrl.searchParams.get("time")
  // TODO: REMOVE - diagnostic
  console.log('[consecutive-offer-api] request received, courseSlug:', courseSlug)
  if (!courseSlug) {
    return NextResponse.json(null)
  }

  try {
    // Find active CourseLinks where the selected course is courseSlugA
    // (the earlier class in the directed A → B link). We intentionally
    // exclude reverse-direction links so a course saved as B never surfaces
    // an offer for its A on a day where the schedule doesn't make sense
    // (e.g. selecting "Salsa Beginner" on a Monday must not offer Rueda,
    // which is only scheduled on Fridays).
    const links = await prisma.courseLink.findMany({
      where: {
        active: true,
        courseSlugA: courseSlug,
      },
    })
    if (links.length === 0) {
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

    const linkedSlugs = links.map((link) => link.courseSlugB)

    const linkedCourses = await prisma.courseCatalog.findMany({
      where: { slug: { in: linkedSlugs } },
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
    const courseAStartMinutes = toMinutes(selectedTime) ?? toMinutes(courseATimesForToday[0])

    const nextClass = linkedCourses
      .filter((candidate) => candidate.active)
      .flatMap((candidate) => {
        const candidateTimes = resolveTimesForWeekday(candidate.scheduleRules, candidate.availableTimes, todayJsWeekday).times
        return candidateTimes
          .map((time) => {
            const minutes = toMinutes(time)
            if (courseAStartMinutes === null || minutes === null || minutes <= courseAStartMinutes) return null
            const link = links.find((item) => item.courseSlugB === candidate.slug)
            return link ? { course: candidate, time, minutes, link } : null
          })
          .filter((item): item is { course: typeof candidate; time: string; minutes: number; link: (typeof links)[number] } => Boolean(item))
      })
      .sort((left, right) => left.minutes - right.minutes)[0]

    if (!nextClass) {
      // TODO: REMOVE - diagnostic
      console.log('[consecutive-offer-api] returning null, reason:', 'no times available for today')
      return NextResponse.json(null)
    }

    // Build the offer
    const regularDropInCents = nextClass.course.dropInPriceCents ?? 0
    const dropInConsecutiveCents = nextClass.link.dropInConsecutiveCents ?? 0
    const packageHolderConsecutiveCents = nextClass.link.packageHolderConsecutiveCents ?? 0
    const discountPercent = computeDiscountPercent(regularDropInCents, dropInConsecutiveCents)

    // TODO: REMOVE - diagnostic
    const offer = {
      linkedCourseSlug: nextClass.course.slug,
      linkedCourseTitle: nextClass.course.title,
      linkedCourseTime: nextClass.time,
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
