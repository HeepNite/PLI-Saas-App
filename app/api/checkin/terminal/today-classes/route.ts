import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { demoCourses, type CourseData } from "@/constants/courses"
import { getStartOfDayNY } from "@/lib/class-schedule"

export const runtime = "nodejs"

const CHECKIN_TIME_ZONE = "America/New_York"
const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const toMonBasedWeekday = (date: Date) => (date.getDay() + 6) % 7

type TodayClassItem = {
  slug: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  dayLabel: string
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
}

/**
 * GET /api/checkin/terminal/today-classes
 *
 * Returns all active CourseCatalog entries that have classes scheduled for today
 * (based on weekday matching from the course's availableWeekdays).
 *
 * Used by the terminal to display a multi-class picker before check-in.
 */
export async function GET() {
  try {
    const now = new Date()
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: CHECKIN_TIME_ZONE,
    }).format(now)

    const todayWeekday = toMonBasedWeekday(now)

    const activeCourses = await prisma.courseCatalog.findMany({
      where: { active: true },
      orderBy: [{ createdAt: "asc" }],
    })

    const todayClasses: TodayClassItem[] = []

    for (const course of activeCourses) {
      const weekdays = course.availableWeekdays || []
      // CourseCatalog stores weekdays as 0=Sun...6=Sat (JS getDay())
      // We need to check if today's weekday matches
      if (!weekdays.includes(now.getDay())) {
        continue
      }

      const times = (course.availableTimes || [])
        .filter((t) => /^\d{2}:\d{2}$/.test(t))
        .sort()

      if (times.length === 0) {
        continue
      }

      const dayLabel = WEEKDAY_LABELS_MON[todayWeekday] || "Today"

      todayClasses.push({
        slug: course.slug,
        title: course.title,
        category: course.category,
        level: course.level,
        durationMinutes: course.durationMinutes,
        availableTimes: times,
        dayLabel,
        dropInPriceCents: course.dropInPriceCents,
        firstClassPriceCents: course.firstClassPriceCents,
        coverImageUrl: course.coverImageUrl,
      })
    }

    return NextResponse.json({
      date: todayKey,
      weekday: todayWeekday,
      dayLabel: WEEKDAY_LABELS_MON[todayWeekday] || "Today",
      classes: todayClasses,
    })
  } catch (error) {
    console.error("Failed to fetch today's classes:", error)
    return NextResponse.json(
      { error: "Unable to fetch today's classes" },
      { status: 500 }
    )
  }
}
