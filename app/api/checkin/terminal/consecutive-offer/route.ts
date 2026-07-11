import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"
import { computeDiscountPercent } from "@/lib/course-links"
import { DEFAULT_DURATION_MINUTES } from "@/lib/checkin/qr"

export const runtime = "nodejs"

const CHECKIN_TIME_ZONE = "America/New_York"
const WEEKDAY_LABELS_JS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const getJsWeekdayInTimeZone = (date: Date, timeZone: string) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)
  return WEEKDAY_LABELS_JS.findIndex((label) => label === weekday)
}

const formatDateInTimeZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(date) // YYYY-MM-DD

const getMinutesInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  return hour * 60 + minute
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
 * Looks up active CourseLinks involving the given course, then uses today's
 * schedule to resolve the next linked class.
 *
 * Used by the terminal to show the consecutive offer early in the flow,
 * before the student checks in or authenticates.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("terminal:consecutive-offer", ip), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
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
    // Find active CourseLinks involving the selected course. The link itself is
    // not treated as direction-authoritative; today's schedule decides which
    // side is the first class and which side can be offered as the consecutive
    // class.
    const links = await prisma.courseLink.findMany({
      where: {
        active: true,
        OR: [{ courseSlugA: courseSlug }, { courseSlugB: courseSlug }],
      },
    })
    if (links.length === 0) {
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

    const linkedSlugs = links.map((link) =>
      link.courseSlugA === courseSlug ? link.courseSlugB : link.courseSlugA
    )

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

    // Check if course B has class on the selected date, falling back to today
    // for legacy terminal callers that do not pass a date.
    const parsedSelectedDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : null
    const now = parsedSelectedDate && !Number.isNaN(parsedSelectedDate.getTime()) ? parsedSelectedDate : new Date()
    const todayJsWeekday = getJsWeekdayInTimeZone(now, CHECKIN_TIME_ZONE) // 0=Sun, 1=Mon, ... in NY time

    // Real wall-clock "now", independent of the resolved/selected date above.
    // Used ONLY to filter out already-passed candidates, and ONLY when the
    // resolved date is actually today — a future-dated selection must never
    // be past-filtered against the current moment.
    const actualNow = new Date()
    const actualCalendarDate = formatDateInTimeZone(actualNow, CHECKIN_TIME_ZONE)
    // Compare the raw selectedDate string (already YYYY-MM-DD in NY-intended
    // form) directly against today's NY calendar date, so this check is
    // independent of the server's local TZ. Round-tripping through a
    // locally-parsed Date (as `now` above does, for weekday/schedule
    // resolution) would make "is this today" sensitive to the server's TZ
    // offset. When selectedDate is absent (legacy callers), treat as today.
    const resolvedDateIsToday = selectedDate ? selectedDate === actualCalendarDate : true
    const nowMinutes = resolvedDateIsToday ? getMinutesInTimeZone(actualNow, CHECKIN_TIME_ZONE) : null

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
            const candidateEndMinutes = minutes + (candidate.durationMinutes ?? DEFAULT_DURATION_MINUTES)
            if (nowMinutes !== null && candidateEndMinutes <= nowMinutes) return null
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
    return NextResponse.json(offer)
  } catch {
    return NextResponse.json(null)
  }
}
