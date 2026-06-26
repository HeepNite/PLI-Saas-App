import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import {
  ACTIVE_BOOKING_STATUSES,
  DEFAULT_CLASS_CAPACITY,
} from "@/lib/bookings"
import { ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import {
  buildSessionStartsAt,
  getCourseBySlug,
  isTimeAllowedForCourseDate,
  parseIsoDate,
  parseTime24,
} from "@/lib/class-schedule"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const isUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:reschedule:post", getClientIp(req)),
      limit: 30,
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const attendanceId = normalizeString(payload?.attendanceId)
    const date = normalizeString(payload?.date)
    const time = normalizeString(payload?.time)

    if (!attendanceId || !parseIsoDate(date) || !parseTime24(time)) {
      return NextResponse.json({ error: "Invalid reschedule payload" }, { status: 400 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const currentAttendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        userId: dbUser.id,
      },
      include: { session: true },
    })

    if (!currentAttendance) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (currentAttendance.status !== ATTENDANCE_STATUS.SCHEDULED) {
      return NextResponse.json({ error: "Only scheduled classes can be changed" }, { status: 400 })
    }

    const courseSlug = currentAttendance.session.courseSlug
    if (!isTimeAllowedForCourseDate(courseSlug, date, time)) {
      return NextResponse.json({ error: "The selected time is not available for this class" }, { status: 400 })
    }

    const startsAt = buildSessionStartsAt(date, time)
    if (!startsAt) {
      return NextResponse.json({ error: "Invalid date or time" }, { status: 400 })
    }

    if (startsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Please select a future schedule" }, { status: 400 })
    }

    const course = getCourseBySlug(courseSlug)
    const targetSession = await prisma.classSession.upsert({
      where: {
        courseSlug_startsAt: {
          courseSlug,
          startsAt,
        },
      },
      update: {
        title: course?.title || currentAttendance.session.title || courseSlug,
        capacity: DEFAULT_CLASS_CAPACITY,
      },
      create: {
        courseSlug,
        startsAt,
        title: course?.title || currentAttendance.session.title || courseSlug,
        durationMinutes: currentAttendance.session.durationMinutes || 60,
        capacity: DEFAULT_CLASS_CAPACITY,
      },
    })

    const occupancy = await prisma.attendance.count({
      where: {
        sessionId: targetSession.id,
        status: { in: ACTIVE_BOOKING_STATUSES },
        NOT: { id: currentAttendance.id },
      },
    })
    const capacity = targetSession.capacity || DEFAULT_CLASS_CAPACITY
    if (occupancy >= capacity) {
      return NextResponse.json({ error: "Class is full for that date/time" }, { status: 409 })
    }

    const userHasConflict = await prisma.attendance.findFirst({
      where: {
        userId: dbUser.id,
        status: { in: ACTIVE_BOOKING_STATUSES },
        NOT: { id: currentAttendance.id },
        session: {
          startsAt,
        },
      },
      select: { id: true },
    })
    if (userHasConflict) {
      return NextResponse.json({ error: "You already have another class booked at that time" }, { status: 409 })
    }

    const currentStartsAtMs = new Date(currentAttendance.session.startsAt).getTime()
    const requestedStartsAtMs = startsAt.getTime()
    if (currentAttendance.sessionId === targetSession.id || currentStartsAtMs === requestedStartsAtMs) {
      return NextResponse.json(
        { error: "Please choose a different date/time than your current booking" },
        { status: 400 }
      )
    }

    let updated
    try {
      updated = await prisma.attendance.update({
        where: { id: currentAttendance.id },
        data: {
          sessionId: targetSession.id,
          status: ATTENDANCE_STATUS.SCHEDULED,
          metadata: {
            ...(currentAttendance.metadata && typeof currentAttendance.metadata === "object"
              ? (currentAttendance.metadata as Record<string, unknown>)
              : {}),
            rescheduledAt: new Date().toISOString(),
            fromSessionId: currentAttendance.sessionId,
            fromStartsAt: currentAttendance.session.startsAt.toISOString(),
          },
        },
        include: { session: true },
      })
    } catch (error) {
      if (isUniqueError(error)) {
        return NextResponse.json({ error: "You already have a booking in that slot" }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      booking: {
        id: updated.id,
        sessionId: updated.sessionId,
        startsAt: updated.session.startsAt.toISOString(),
        courseSlug,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error("Profile bookings reschedule POST failed", error)
    return NextResponse.json({ error: "Unable to reschedule class" }, { status: 500 })
  }
}
