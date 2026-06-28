import { NextRequest, NextResponse } from "next/server"
import { buildTodayTerminalClasses, getDateKeyForTerminal } from "@/lib/checkin/terminal-current-class"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const CHECKIN_TIME_ZONE = "America/New_York"
const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const getMonBasedWeekdayInTerminalZone = (date: Date) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: CHECKIN_TIME_ZONE, weekday: "short" }).format(date)
  const jsLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
  const jsWeekday = jsLabels.findIndex((label) => label === weekday)
  return jsWeekday >= 0 ? (jsWeekday + 6) % 7 : (date.getDay() + 6) % 7
}

/**
 * GET /api/checkin/terminal/today-classes
 *
 * Returns all active CourseCatalog entries that have classes scheduled for today
 * using the same terminal current-class source used by staff fast actions.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("terminal:today-classes", ip), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  try {
    const now = new Date()
    const activeCourses = await prisma.courseCatalog.findMany({
      where: { active: true },
      orderBy: [{ createdAt: "asc" }],
      take: 100,
    })
    const todayWeekday = getMonBasedWeekdayInTerminalZone(now)

    return NextResponse.json({
      date: getDateKeyForTerminal(now),
      weekday: todayWeekday,
      dayLabel: WEEKDAY_LABELS_MON[todayWeekday] || "Today",
      classes: buildTodayTerminalClasses(activeCourses, now).map((item) => ({
        slug: item.slug,
        title: item.title,
        category: item.category,
        level: item.level,
        durationMinutes: item.durationMinutes,
        availableTimes: item.availableTimes,
        dayLabel: item.dayLabel,
        dropInPriceCents: item.dropInPriceCents,
        firstClassPriceCents: item.firstClassPriceCents,
        coverImageUrl: item.coverImageUrl,
      })),
    })
  } catch (error) {
    console.error("Failed to fetch today's classes:", error)
    return NextResponse.json(
      { error: "Unable to fetch today's classes" },
      { status: 500 }
    )
  }
}
