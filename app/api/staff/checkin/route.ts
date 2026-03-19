import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumePackageCreditForAttendance } from "@/lib/packages"
import { authorizeStaffRequest } from "@/lib/security/staff-auth"
import { validateCheckInBody } from "@/lib/security/checkin-validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"

export const runtime = "nodejs"
const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"]
const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:checkin:post", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const staffAuth = await authorizeStaffRequest(req)
  if (!staffAuth.ok) {
    return NextResponse.json({ error: staffAuth.error }, { status: staffAuth.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = validateCheckInBody(body)
  if ("status" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const userSearchOr: Array<Record<string, string>> = []
  if (parsed.userClerkId) userSearchOr.push({ clerkId: parsed.userClerkId })
  if (parsed.email) userSearchOr.push({ email: parsed.email })

  const user = await prisma.user.findFirst({
    where: {
      OR: userSearchOr,
    },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const startsAt = parsed.startsAt || new Date()
  const durationMinutes = parsed.durationMinutes
  const sessionTitle = parsed.sessionTitle || parsed.courseSlug

  const session = await prisma.classSession.upsert({
    where: {
      courseSlug_startsAt: {
        courseSlug: parsed.courseSlug,
        startsAt,
      },
    },
    update: {
      title: sessionTitle,
      durationMinutes,
      ...(parsed.location ? { location: parsed.location } : {}),
    },
    create: {
      courseSlug: parsed.courseSlug,
      title: sessionTitle,
      startsAt,
      durationMinutes,
      ...(parsed.location ? { location: parsed.location } : {}),
    },
  })

  const attendance = await prisma.attendance.upsert({
    where: {
      userId_sessionId: {
        userId: user.id,
        sessionId: session.id,
      },
    },
    update: {
      status: "checked_in",
      checkedInAt: new Date(),
      metadata: parsed.notes ? { notes: parsed.notes } : undefined,
    },
    create: {
      userId: user.id,
      sessionId: session.id,
      status: "checked_in",
      metadata: parsed.notes ? { notes: parsed.notes } : undefined,
    },
  })

  const packageResult = await consumePackageCreditForAttendance({
    userId: user.id,
    attendanceId: attendance.id,
    courseSlug: parsed.courseSlug,
    checkedInAt: attendance.checkedInAt,
  })

  const attendanceStatus = packageResult.packagePurchase ? "checked_in" : "checked_in_no_package"
  if (!packageResult.packagePurchase) {
    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { status: "checked_in_no_package" },
    })
  }

  const checkedInCount = await prisma.attendance.count({
    where: {
      userId: user.id,
      status: { in: ATTENDANCE_POINT_STATUSES },
      session: { courseSlug: parsed.courseSlug },
    },
  })

  const attendanceMilestoneEvery = await getAttendanceMilestoneClasses()
  let pointsAwarded = 0
  let attendanceMilestone = 0
  if (checkedInCount > 0 && checkedInCount % attendanceMilestoneEvery === 0) {
    attendanceMilestone = Math.floor(checkedInCount / attendanceMilestoneEvery)
    const pointsResult = await awardPointsFromRule({
      userId: user.id,
      ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
      eventKey: attendanceMilestoneEventKey(user.id, parsed.courseSlug, attendanceMilestone),
      fallbackType: "CONSECUTIVE_ATTENDANCE",
      meta: {
        source: "staff_checkin",
        courseSlug: parsed.courseSlug,
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
    attendance: {
      id: attendance.id,
      status: attendanceStatus,
      checkedInAt: attendance.checkedInAt.toISOString(),
      courseSlug: parsed.courseSlug,
      sessionTitle,
    },
    package: packageResult.packagePurchase
      ? {
          id: packageResult.packagePurchase.id,
          packageId: packageResult.packagePurchase.packageId,
          label: packageResult.packagePurchase.packageLabel,
          isUnlimited: packageResult.packagePurchase.isUnlimited,
          remainingCredits: packageResult.packagePurchase.remainingCredits,
          status: packageResult.packagePurchase.status,
        }
      : null,
    consumed: packageResult.consumed,
    points: {
      awarded: pointsAwarded,
      milestone: attendanceMilestone > 0 ? attendanceMilestone : null,
      attendanceCount: checkedInCount,
      milestoneEvery: attendanceMilestoneEvery,
    },
  })
}
