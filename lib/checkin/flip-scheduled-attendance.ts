import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { ATTENDANCE_POINT_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

export const checkedInAttendanceInclude = {
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
} satisfies Prisma.AttendanceInclude

type ScheduledAttendanceInput = {
  id: string
  status: string
  metadata: Prisma.JsonValue | null
  packageUsage?: { packagePurchaseId: string | null } | null
}

/**
 * Flips a reserved (`scheduled`) attendance to checked in at `now`. The package
 * credit was already reserved at booking time, so this never reserves or
 * consumes another credit: it only picks CHECKED_IN (credit reserved) or
 * CHECKED_IN_NO_PACKAGE (drop-in) and awards the attendance milestone points.
 * Returns null (no write) when the attendance is not `scheduled`.
 */
export async function checkInScheduledAttendance(input: {
  attendance: ScheduledAttendanceInput
  userId: string
  now: Date
  checkInSource: string
  pointsSource: string
}) {
  const { attendance, userId, now } = input
  if (attendance.status !== ATTENDANCE_STATUS.SCHEDULED) return null

  const metadata =
    attendance.metadata && typeof attendance.metadata === "object"
      ? (attendance.metadata as Record<string, unknown>)
      : {}
  const hasReservedPackage = Boolean(attendance.packageUsage?.packagePurchaseId)
  const nextStatus = hasReservedPackage ? ATTENDANCE_STATUS.CHECKED_IN : ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE

  // Guarded on the status still being `scheduled`, so a concurrent check-in, cancellation or
  // double scan never overwrites the attendance: only one caller performs the flip.
  const flipped = await prisma.attendance.updateMany({
    where: { id: attendance.id, status: ATTENDANCE_STATUS.SCHEDULED },
    data: {
      status: nextStatus,
      checkedInAt: now,
      metadata: {
        ...metadata,
        checkInSource: input.checkInSource,
        checkedInFromStatus: attendance.status,
      } as Prisma.InputJsonValue,
    },
  })
  if (flipped.count !== 1) return null
  const updatedAttendance = await prisma.attendance.findUniqueOrThrow({
    where: { id: attendance.id },
    include: checkedInAttendanceInclude,
  })

  const courseSlug = updatedAttendance.session.courseSlug
  let checkedInCount = 0
  let milestoneEvery = 0
  let pointsAwarded = 0
  let milestone = 0
  // The check-in is already committed: a points failure must not report it as not checked in.
  try {
    checkedInCount = await prisma.attendance.count({
      where: {
        userId,
        status: { in: [...ATTENDANCE_POINT_STATUSES] },
        session: { courseSlug },
      },
    })
    milestoneEvery = await getAttendanceMilestoneClasses()
    if (checkedInCount > 0 && checkedInCount % milestoneEvery === 0) {
      milestone = Math.floor(checkedInCount / milestoneEvery)
      const pointsResult = await awardPointsFromRule({
        userId,
        ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
        eventKey: attendanceMilestoneEventKey(userId, courseSlug, milestone),
        fallbackType: "CONSECUTIVE_ATTENDANCE",
        meta: {
          source: input.pointsSource,
          courseSlug,
          milestoneEvery,
          milestone,
          attendanceCount: checkedInCount,
        },
      })
      if (pointsResult.awarded) {
        pointsAwarded = pointsResult.points
      }
    }
  } catch (error) {
    console.error("[checkin] attendance milestone points failed after check-in", error)
  }

  return { attendance: updatedAttendance, checkedInCount, milestoneEvery, pointsAwarded, milestone }
}

/**
 * Kiosk identification (phone or QR) of a student for a class session. Reports
 * whether the student already has an attendance for it, and when that
 * attendance is a reservation (`scheduled`) and check-in is allowed, checks the
 * student in. A failed flip is logged and leaves the kiosk flow unchanged.
 */
export async function checkInReservedAttendanceAtKiosk(input: {
  userId: string
  sessionId: string
  now: Date
  allowCheckIn: boolean
}): Promise<{ hasAttendance: boolean; checkedIn: boolean }> {
  const attendance = await prisma.attendance.findUnique({
    where: { userId_sessionId: { userId: input.userId, sessionId: input.sessionId } },
    select: { id: true, status: true, metadata: true, packageUsage: { select: { packagePurchaseId: true } } },
  })
  if (!attendance) return { hasAttendance: false, checkedIn: false }
  if (!input.allowCheckIn || attendance.status !== ATTENDANCE_STATUS.SCHEDULED) {
    return { hasAttendance: true, checkedIn: false }
  }

  try {
    // A special-class reservation keeps its own check-in rules (cancelled class, card capture);
    // the kiosk leaves it untouched.
    const specialClass = await prisma.specialClass.findUnique({
      where: { classSessionId: input.sessionId },
      select: { id: true },
    })
    if (specialClass) return { hasAttendance: true, checkedIn: false }

    const result = await checkInScheduledAttendance({
      attendance,
      userId: input.userId,
      now: input.now,
      checkInSource: "kiosk_terminal",
      pointsSource: "kiosk_checkin",
    })
    return { hasAttendance: true, checkedIn: Boolean(result) }
  } catch (error) {
    console.error("[kiosk-reserved-checkin] check-in of a reserved class failed", error)
    return { hasAttendance: true, checkedIn: false }
  }
}
