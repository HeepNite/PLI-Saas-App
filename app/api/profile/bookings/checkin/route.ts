import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"

export const runtime = "nodejs"

const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"] as const
const CHECK_IN_OPEN_WINDOW_MS = 2 * 60 * 60 * 1000
const CHECK_IN_CLOSE_AFTER_END_MS = 2 * 60 * 60 * 1000

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:checkin:post", getClientIp(req)),
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

    if (!attendanceId) {
      return NextResponse.json({ error: "Invalid check-in payload" }, { status: 400 })
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

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        userId: dbUser.id,
      },
      include: {
        session: true,
        packageUsage: {
          include: {
            packagePurchase: {
              select: {
                id: true,
                packageId: true,
                packageLabel: true,
                isUnlimited: true,
                remainingCredits: true,
                status: true,
              },
            },
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const now = new Date()
    const nowMs = now.getTime()
    const startsAtMs = attendance.session.startsAt.getTime()
    const durationMinutes = Number.isFinite(attendance.session.durationMinutes)
      ? Math.max(15, Math.min(240, Math.round(attendance.session.durationMinutes as number)))
      : 60
    const endsAtMs = startsAtMs + durationMinutes * 60 * 1000

    if (startsAtMs > nowMs + CHECK_IN_OPEN_WINDOW_MS) {
      return NextResponse.json(
        { error: "Check-in opens 2 hours before your class starts." },
        { status: 400 }
      )
    }

    if (nowMs > endsAtMs + CHECK_IN_CLOSE_AFTER_END_MS) {
      return NextResponse.json(
        { error: "Check-in window closed for this class." },
        { status: 400 }
      )
    }

    if (ATTENDANCE_POINT_STATUSES.includes(attendance.status as (typeof ATTENDANCE_POINT_STATUSES)[number])) {
      const checkedInCount = await prisma.attendance.count({
        where: {
          userId: dbUser.id,
          status: { in: [...ATTENDANCE_POINT_STATUSES] },
          session: { courseSlug: attendance.session.courseSlug },
        },
      })
      const attendanceMilestoneEvery = await getAttendanceMilestoneClasses()

      return NextResponse.json({
        alreadyCheckedIn: true,
        attendance: {
          id: attendance.id,
          status: attendance.status,
          checkedInAt: attendance.checkedInAt.toISOString(),
          startsAt: attendance.session.startsAt.toISOString(),
          courseSlug: attendance.session.courseSlug,
          sessionTitle: attendance.session.title || attendance.session.courseSlug,
        },
        package: attendance.packageUsage?.packagePurchase || null,
        points: {
          awarded: 0,
          milestone: null,
          attendanceCount: checkedInCount,
          milestoneEvery: attendanceMilestoneEvery,
        },
      })
    }

    if (attendance.status !== "scheduled") {
      return NextResponse.json(
        { error: "Only scheduled classes can be checked in." },
        { status: 400 }
      )
    }

    const metadata =
      attendance.metadata && typeof attendance.metadata === "object"
        ? (attendance.metadata as Record<string, unknown>)
        : {}
    const hasReservedPackage = Boolean(attendance.packageUsage?.packagePurchaseId)
    const nextStatus = hasReservedPackage ? "checked_in" : "checked_in_no_package"

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        status: nextStatus,
        checkedInAt: now,
        metadata: {
          ...metadata,
          checkInSource: "client_profile",
          checkedInFromStatus: attendance.status,
        },
      },
      include: {
        session: true,
        packageUsage: {
          include: {
            packagePurchase: {
              select: {
                id: true,
                packageId: true,
                packageLabel: true,
                isUnlimited: true,
                remainingCredits: true,
                status: true,
              },
            },
          },
        },
      },
    })

    const checkedInCount = await prisma.attendance.count({
      where: {
        userId: dbUser.id,
        status: { in: [...ATTENDANCE_POINT_STATUSES] },
        session: { courseSlug: updatedAttendance.session.courseSlug },
      },
    })

    const attendanceMilestoneEvery = await getAttendanceMilestoneClasses()
    let pointsAwarded = 0
    let attendanceMilestone = 0
    if (checkedInCount > 0 && checkedInCount % attendanceMilestoneEvery === 0) {
      attendanceMilestone = Math.floor(checkedInCount / attendanceMilestoneEvery)
      const pointsResult = await awardPointsFromRule({
        userId: dbUser.id,
        ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
        eventKey: attendanceMilestoneEventKey(dbUser.id, updatedAttendance.session.courseSlug, attendanceMilestone),
        fallbackType: "CONSECUTIVE_ATTENDANCE",
        meta: {
          source: "profile_checkin",
          courseSlug: updatedAttendance.session.courseSlug,
          milestoneEvery: attendanceMilestoneEvery,
          milestone: attendanceMilestone,
          attendanceCount: checkedInCount,
        },
      })
      if (pointsResult.awarded) {
        pointsAwarded = pointsResult.points
      }
    }

    return NextResponse.json({
      alreadyCheckedIn: false,
      attendance: {
        id: updatedAttendance.id,
        status: updatedAttendance.status,
        checkedInAt: updatedAttendance.checkedInAt.toISOString(),
        startsAt: updatedAttendance.session.startsAt.toISOString(),
        courseSlug: updatedAttendance.session.courseSlug,
        sessionTitle: updatedAttendance.session.title || updatedAttendance.session.courseSlug,
      },
      package: updatedAttendance.packageUsage?.packagePurchase || null,
      points: {
        awarded: pointsAwarded,
        milestone: attendanceMilestone > 0 ? attendanceMilestone : null,
        attendanceCount: checkedInCount,
        milestoneEvery: attendanceMilestoneEvery,
      },
    })
  } catch (error) {
    console.error("Profile bookings check-in POST failed", error)
    return NextResponse.json({ error: "Unable to check in class" }, { status: 500 })
  }
}
