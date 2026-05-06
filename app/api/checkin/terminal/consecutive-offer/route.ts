import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTimesForWeekday } from "@/lib/schedule-rules"
import { computeDiscountPercent } from "@/lib/course-links"

export const runtime = "nodejs"

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

    // Check if course B exists and is active
    const courseB = await prisma.courseCatalog.findUnique({
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
    if (!courseB || !courseB.active) {
      // TODO: REMOVE - diagnostic
      console.log('[consecutive-offer-api] returning null, reason:', 'courseB not found or not active')
      return NextResponse.json(null)
    }

    // Check if course B has class today
    const now = new Date()
    const todayJsWeekday = now.getDay() // 0=Sun, 1=Mon, ...

    // TODO: REMOVE - diagnostic
    console.log('[consecutive-offer-api] weekday check:', { serverDay: now.getDay(), todayJsWeekday, courseB_weekdays: courseB.availableWeekdays })

    if (!courseB.availableWeekdays.includes(todayJsWeekday)) {
      // TODO: REMOVE - diagnostic
      console.log('[consecutive-offer-api] returning null, reason:', 'courseB not available today')
      return NextResponse.json(null)
    }

    // Resolve day-specific times for course B
    const timesForToday = getTimesForWeekday(courseB.scheduleRules, todayJsWeekday)
      ?? courseB.availableTimes

    if (!timesForToday || timesForToday.length === 0) {
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
