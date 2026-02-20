import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_CLASS_CAPACITY,
  ACTIVE_BOOKING_STATUSES,
} from "@/lib/bookings"
import {
  buildSessionStartsAt,
  formatTime12h,
  getAvailableTimesForCourseDate,
  isSlotInPastForTimeZone,
  parseIsoDate,
} from "@/lib/class-schedule"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
const NY_TIMEZONE = "America/New_York"

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:availability:get", getClientIp(req)),
      limit: 120,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const courseSlug = (searchParams.get("courseSlug") || "").trim()
    const date = (searchParams.get("date") || "").trim()
    const excludeAttendanceId = (searchParams.get("excludeAttendanceId") || "").trim()

    if (!courseSlug || !date || !parseIsoDate(date)) {
      return NextResponse.json({ error: "Missing or invalid course/date" }, { status: 400 })
    }

    const times = getAvailableTimesForCourseDate(courseSlug, date)
    if (!times.length) {
      return NextResponse.json({ slots: [] })
    }

    const slots = await Promise.all(
      times.map(async (time) => {
        if (isSlotInPastForTimeZone(date, time, NY_TIMEZONE)) {
          return {
            time,
            label: formatTime12h(time),
            isFull: true,
            spotsLeft: 0,
            capacity: DEFAULT_CLASS_CAPACITY,
            isPast: true,
          }
        }

        const startsAt = buildSessionStartsAt(date, time)
        if (!startsAt) {
          return {
            time,
            label: formatTime12h(time),
            isFull: true,
            spotsLeft: 0,
            capacity: DEFAULT_CLASS_CAPACITY,
            isPast: false,
          }
        }

        const session = await prisma.classSession.findUnique({
          where: {
            courseSlug_startsAt: {
              courseSlug,
              startsAt,
            },
          },
          select: { id: true, capacity: true },
        })

        const capacity = session?.capacity ?? DEFAULT_CLASS_CAPACITY
        const used = session
          ? await prisma.attendance.count({
              where: {
                sessionId: session.id,
                status: { in: ACTIVE_BOOKING_STATUSES },
                ...(excludeAttendanceId ? { NOT: { id: excludeAttendanceId } } : {}),
              },
            })
          : 0
        const spotsLeft = Math.max(0, capacity - used)

        return {
          time,
          label: formatTime12h(time),
          isFull: spotsLeft <= 0,
          spotsLeft,
          capacity,
          isPast: false,
        }
      })
    )

    return NextResponse.json({ slots })
  } catch (error) {
    console.error("Profile bookings availability GET failed", error)
    return NextResponse.json({ error: "Unable to load availability" }, { status: 500 })
  }
}
