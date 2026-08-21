import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_DURATION_MINUTES } from "@/lib/checkin/qr"
import { CHECKIN_TIME_ZONE, toMinutes } from "@/lib/checkin/checkin-helpers"
import { getEtDateIso, getEtHourMinute } from "@/lib/checkin/et-time"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"
import { computeDiscountPercent } from "@/lib/course-links"

export const runtime = "nodejs"

const WEEKDAY_LABELS_JS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const getJsWeekdayInTimeZone = (date: Date, timeZone: string) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)
  return WEEKDAY_LABELS_JS.findIndex((label) => label === weekday)
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
 * Looks up active CourseLinks involving the given course, then uses today's
 * schedule to resolve the next linked class.
 *
 * Used by the terminal to show the consecutive offer early in the flow,
 * before the student checks in or authenticates.
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const db: Record<string, number> = {}
  const measureDatabaseCall = async <T>(name: string, operation: () => Promise<T>) => {
    const callStartedAt = Date.now()
    try {
      return await operation()
    } finally {
      db[name] = Date.now() - callStartedAt
    }
  }
  const logTiming = (outcome: "offer" | "no_offer" | "failed") => {
    console.info("[terminal-consecutive-offer-latency] route", {
      db,
      durationMs: Date.now() - startedAt,
      outcome,
    })
  }
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkin:terminal:consecutive-offer:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const courseSlug = req.nextUrl.searchParams.get("courseSlug")
  const selectedTime = req.nextUrl.searchParams.get("time")
  const selectedDate = req.nextUrl.searchParams.get("date")
  if (!courseSlug) {
    return NextResponse.json(null)
  }

  try {
    const now = new Date()
    const todayIso = getEtDateIso(now)
    if (selectedDate && selectedDate !== todayIso) {
      return NextResponse.json(null)
    }

    // Find active CourseLinks involving the selected course. The link itself is
    // not treated as direction-authoritative; today's schedule decides which
    // side is the first class and which side can be offered as the consecutive
    // class.
    const links = await measureDatabaseCall("courseLinksMs", () => prisma.courseLink.findMany({
      where: {
        active: true,
        OR: [{ courseSlugA: courseSlug }, { courseSlugB: courseSlug }],
      },
    }))
    if (links.length === 0) {
      logTiming("no_offer")
      return NextResponse.json(null)
    }

    const courseA = await measureDatabaseCall("courseMs", () => prisma.courseCatalog.findUnique({
      where: { slug: courseSlug },
      select: {
        slug: true,
        availableTimes: true,
        scheduleRules: true,
      },
    }))

    const linkedSlugs = links.map((link) =>
      link.courseSlugA === courseSlug ? link.courseSlugB : link.courseSlugA
    )

    const linkedCourses = await measureDatabaseCall("linkedCoursesMs", () => prisma.courseCatalog.findMany({
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
    }))

    const todayJsWeekday = getJsWeekdayInTimeZone(now, CHECKIN_TIME_ZONE) // 0=Sun, 1=Mon, ... in NY time
    const { hour, minute } = getEtHourMinute(now)
    const nowMinutes = hour * 60 + minute

    const courseATimesForToday = courseA
      ? resolveTimesForWeekday(courseA.scheduleRules, courseA.availableTimes, todayJsWeekday).times
      : []
    if (selectedTime && !courseATimesForToday.includes(selectedTime)) {
      return NextResponse.json(null)
    }
    const fallbackCourseATime = courseATimesForToday[0]
    const courseAStartMinutes = selectedTime
      ? toMinutes(selectedTime)
      : fallbackCourseATime
        ? toMinutes(fallbackCourseATime)
        : null

    const nextClass = linkedCourses
      .filter((candidate) => candidate.active)
      .flatMap((candidate) => {
        const candidateTimes = resolveTimesForWeekday(candidate.scheduleRules, candidate.availableTimes, todayJsWeekday).times
        return candidateTimes
          .map((time) => {
            const minutes = toMinutes(time)
            if (courseAStartMinutes === null || minutes === null || minutes <= courseAStartMinutes) return null
            const candidateEndMinutes = minutes + (candidate.durationMinutes ?? DEFAULT_DURATION_MINUTES)
            if (candidateEndMinutes <= nowMinutes) return null
            const link = links.find((item) =>
              (item.courseSlugA === courseSlug && item.courseSlugB === candidate.slug) ||
              (item.courseSlugB === courseSlug && item.courseSlugA === candidate.slug)
            )
            return link ? { course: candidate, time, minutes, link } : null
          })
          .filter((item): item is { course: typeof candidate; time: string; minutes: number; link: (typeof links)[number] } => Boolean(item))
      })
      .sort((left, right) => left.minutes - right.minutes)[0]

    if (!nextClass) {
      logTiming("no_offer")
      return NextResponse.json(null)
    }

    // Build the offer
    const regularDropInCents = nextClass.course.dropInPriceCents ?? 0
    const dropInConsecutiveCents = nextClass.link.dropInConsecutiveCents ?? 0
    const packageHolderConsecutiveCents = nextClass.link.packageHolderConsecutiveCents ?? 0
    const discountPercent = computeDiscountPercent(regularDropInCents, dropInConsecutiveCents)

    const offer = {
      linkedFromCourseSlug: courseSlug,
      linkedCourseSlug: nextClass.course.slug,
      linkedCourseTitle: nextClass.course.title,
      linkedCourseTime: nextClass.time,
      dropInConsecutiveCents,
      packageHolderConsecutiveCents,
      regularDropInCents,
      discountPercent,
      hasAttendedFirstClass: false, // pre-payment — attendance hasn't happened yet
    }
    logTiming("offer")
    return NextResponse.json(offer)
  } catch {
    logTiming("failed")
    return NextResponse.json(null)
  }
}
