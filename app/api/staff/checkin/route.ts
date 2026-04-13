import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumePackageCreditForAttendance } from "@/lib/packages"
import { authorizeStaffRequest } from "@/lib/security/staff-auth"
import { validateCheckInBody, validateCheckOutBody } from "@/lib/security/checkin-validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { buildSessionEndsAtUtc, findOverlappingRoomSession, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"

export const runtime = "nodejs"
const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"]
const CHECKOUT_ELIGIBLE_STATUSES = ["checked_in", "checked_in_no_package"]
const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

const roomDelegate = (prisma as typeof prisma & {
  room: {
    findUnique: (args: unknown) => Promise<{
      id: string
      name: string
      capacity: number
      location: string | null
      active: boolean
    } | null>
  }
}).room

const classSessionDelegate = prisma.classSession as typeof prisma.classSession & {
  findUnique: (args: unknown) => Promise<{ id: string; roomId: string | null } | null>
  findMany: (args: unknown) => Promise<
    Array<{
      id: string
      roomId: string | null
      startsAt: Date
      durationMinutes: number | null
      title: string | null
      courseSlug: string
    }>
  >
}

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

  const course = await prisma.courseCatalog.findUnique({
    where: { slug: parsed.courseSlug },
    select: { title: true, dropInPriceCents: true }
  })

  const startsAt = parsed.startsAt || new Date()
  const durationMinutes = parsed.durationMinutes
  const sessionTitle = parsed.sessionTitle || course?.title || parsed.courseSlug
  const endsAt = buildSessionEndsAtUtc(startsAt, durationMinutes)

  if (!endsAt) {
    return NextResponse.json({ error: "Invalid session schedule" }, { status: 400 })
  }

  const existingSession = await classSessionDelegate.findUnique({
    where: {
      courseSlug_startsAt: {
        courseSlug: parsed.courseSlug,
        startsAt,
      },
    },
    select: {
      id: true,
      roomId: true,
    },
  })

  if (parsed.roomId) {
    const assignedRoom = await roomDelegate.findUnique({
      where: { id: parsed.roomId },
      select: {
        id: true,
        name: true,
        capacity: true,
        location: true,
        active: true,
      },
    })

    if (!assignedRoom || !assignedRoom.active) {
      return NextResponse.json({ error: "Assigned room not found or inactive." }, { status: 404 })
    }

    const roomSessions = await classSessionDelegate.findMany({
      where: {
        roomId: parsed.roomId,
        startsAt: { lt: endsAt },
        ...(existingSession ? { id: { not: existingSession.id } } : {}),
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        roomId: true,
        startsAt: true,
        durationMinutes: true,
        title: true,
        courseSlug: true,
      },
    })

    const conflictingSession = findOverlappingRoomSession(roomSessions, {
      roomId: parsed.roomId,
      startsAt,
      durationMinutes,
      excludeSessionId: existingSession?.id,
    })

    if (conflictingSession) {
      const conflictingEndsAt = buildSessionEndsAtUtc(conflictingSession.startsAt, conflictingSession.durationMinutes)
      return NextResponse.json(
        {
          error: "Room is unavailable for the requested time slot.",
          conflict: {
            sessionId: conflictingSession.id,
            courseSlug: conflictingSession.courseSlug,
            title: conflictingSession.title,
            startsAt: conflictingSession.startsAt.toISOString(),
            endsAt: conflictingEndsAt?.toISOString() ?? null,
            room: {
              id: assignedRoom.id,
              name: assignedRoom.name,
              capacity: assignedRoom.capacity,
              location: assignedRoom.location,
              active: assignedRoom.active,
            },
          },
        },
        { status: 409 }
      )
    }
  }

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
      ...(parsed.roomId ? { roomId: parsed.roomId } : {}),
    },
    create: {
      courseSlug: parsed.courseSlug,
      title: sessionTitle,
      startsAt,
      durationMinutes,
      ...(parsed.location ? { location: parsed.location } : {}),
      ...(parsed.roomId ? { roomId: parsed.roomId } : {}),
    },
  })

  const persistedRoomId = parsed.roomId ?? existingSession?.roomId ?? null
  const sessionRoom = persistedRoomId
    ? await roomDelegate.findUnique({
        where: { id: persistedRoomId },
        select: {
          id: true,
          name: true,
          capacity: true,
          location: true,
          active: true,
        },
      })
    : null

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
  const packagePurchase = packageResult.packagePurchase

  const attendanceStatus = packagePurchase ? "checked_in" : "checked_in_no_package"
  const purchaseDate = getDateKeyInTimeZone(startsAt)
  const purchaseTime = getTimeKeyInTimeZone(startsAt)

  if (!packagePurchase) {
    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { status: "checked_in_no_package" },
    })
    
    await prisma.purchase.create({
      data: {
        userId: user.id,
        courseSlug: parsed.courseSlug,
        courseTitle: course?.title || parsed.courseSlug,
        amount: course?.dropInPriceCents || 0,
        currency: "usd",
        status: "pending",
        email: user.email || null,
        name: user.name || null,
        phone: user.phone || null,
        metadata: {
          paymentChannel: "cash",
          settlementStatus: "pending",
          date: purchaseDate,
          time: purchaseTime,
          source: "staff_checkin_no_package",
          attendanceId: attendance.id,
        },
      },
    })
  } else {
    await prisma.$transaction(async (tx) => {
      await ensureAttendancePackagePurchase(tx, {
        attendanceId: attendance.id,
        userId: user.id,
        courseSlug: parsed.courseSlug,
        courseTitle: course?.title || parsed.courseSlug,
        email: user.email || null,
        name: user.name || null,
        phone: user.phone || null,
        packageId: packagePurchase.packageId,
        packagePurchaseId: packagePurchase.id,
        source: "staff_checkin_package",
        date: purchaseDate,
        time: purchaseTime,
      })
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
    session: {
      id: session.id,
      courseSlug: session.courseSlug ?? parsed.courseSlug,
      title: session.title ?? session.courseSlug ?? sessionTitle,
      startsAt: (session.startsAt instanceof Date ? session.startsAt : startsAt).toISOString(),
      endsAt: endsAt.toISOString(),
      location: session.location ?? null,
      room: sessionRoom
        ? {
            id: sessionRoom.id,
            name: sessionRoom.name,
            capacity: sessionRoom.capacity,
            location: sessionRoom.location,
            active: sessionRoom.active,
          }
        : null,
    },
    package: packagePurchase
      ? {
          id: packagePurchase.id,
          packageId: packagePurchase.packageId,
          label: packagePurchase.packageLabel,
          isUnlimited: packagePurchase.isUnlimited,
          remainingCredits: packagePurchase.remainingCredits,
          status: packagePurchase.status,
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

export async function PATCH(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:checkin:patch", getClientIp(req)),
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

  const parsed = validateCheckOutBody(body)
  if ("status" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const existingAttendance = await prisma.attendance.findUnique({
    where: { id: parsed.attendanceId },
    include: { session: true },
  })

  if (!existingAttendance) {
    return NextResponse.json({ error: "Attendance not found" }, { status: 404 })
  }

  if (existingAttendance.checkedOutAt) {
    return NextResponse.json({ error: "Attendance already checked out" }, { status: 409 })
  }

  if (!CHECKOUT_ELIGIBLE_STATUSES.includes(existingAttendance.status)) {
    return NextResponse.json({ error: "Attendance is not eligible for check-out" }, { status: 409 })
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: existingAttendance.id },
    data: {
      status: "checked_out",
      checkedOutAt: new Date(),
    },
    include: { session: true },
  })

  return NextResponse.json({
    attendance: {
      id: updatedAttendance.id,
      status: updatedAttendance.status,
      checkedInAt: updatedAttendance.checkedInAt.toISOString(),
      checkedOutAt: updatedAttendance.checkedOutAt?.toISOString() ?? null,
      courseSlug: updatedAttendance.session.courseSlug,
      sessionTitle: updatedAttendance.session.title ?? updatedAttendance.session.courseSlug,
    },
  })
}
