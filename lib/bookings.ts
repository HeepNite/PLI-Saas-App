import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt, getCourseBySlug } from "@/lib/class-schedule"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

const DEFAULT_DURATION_MINUTES = 60
export const DEFAULT_CLASS_CAPACITY = 12
export { ACTIVE_BOOKING_STATUSES } from "@/lib/attendance-constants"

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

export const syncScheduledAttendanceFromPurchase = async (input: {
  userId: string
  purchaseId: string
  courseSlug: string
  courseTitle?: string | null
  date?: string | null
  time?: string | null
  packagePurchaseId?: string | null
  preferredStatus?: "scheduled" | "checked_in" | "checked_in_no_package"
  source?: string
}) => {
  const isSpecialClass = input.courseSlug === SPECIAL_SALSA_CLASS.courseSlug
  const date = input.date?.trim()
  const time = input.time?.trim()
  if (!isSpecialClass && (!date || !time)) return null

  const startsAt = isSpecialClass
    ? SPECIAL_SALSA_CLASS.startsAt
    : buildSessionStartsAt(date as string, time as string)
  if (!startsAt) return null

  const course = getCourseBySlug(input.courseSlug)
  const sessionTitle = isSpecialClass
    ? SPECIAL_SALSA_CLASS.title
    : course?.title || input.courseTitle || input.courseSlug
  const durationMinutes = isSpecialClass ? SPECIAL_SALSA_CLASS.durationMinutes : DEFAULT_DURATION_MINUTES
  const capacity = isSpecialClass ? SPECIAL_SALSA_CLASS.capacity : DEFAULT_CLASS_CAPACITY
  const preferredStatus = input.preferredStatus || ATTENDANCE_STATUS.SCHEDULED
  const source = input.source || "purchase_booking"

  const shouldUpgradeStatus = (current: string) => {
    if (preferredStatus === ATTENDANCE_STATUS.CHECKED_IN) return current === ATTENDANCE_STATUS.SCHEDULED
    if (preferredStatus === ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE) return current === ATTENDANCE_STATUS.SCHEDULED
    return false
  }

  return prisma.$transaction(async (tx) => {
    const existingByPurchase = await tx.attendance.findFirst({
      where: {
        userId: input.userId,
        metadata: {
          path: ["purchaseId"],
          equals: input.purchaseId,
        },
        session: {
          courseSlug: input.courseSlug,
          startsAt,
        },
      },
    })

    if (existingByPurchase) {
      if (shouldUpgradeStatus(existingByPurchase.status)) {
        await tx.attendance.update({
          where: { id: existingByPurchase.id },
          data: {
            status: preferredStatus,
            checkedInAt: startsAt,
          },
        })
      }
      if (input.packagePurchaseId) {
        try {
          await reservePackageCreditForAttendanceTx(tx, {
            packagePurchaseId: input.packagePurchaseId,
            userId: input.userId,
            attendanceId: existingByPurchase.id,
            courseSlug: input.courseSlug,
            at: startsAt,
            reason: "PACKAGE_INITIAL_BOOKING",
          })
        } catch (error) {
          if (!isUniqueConstraintError(error)) {
            console.error("Failed to reserve package credit for existing purchase attendance", error)
          }
        }
      }

      return { session: null, attendance: existingByPurchase }
    }

    const session = await tx.classSession.upsert({
      where: {
        courseSlug_startsAt: {
          courseSlug: input.courseSlug,
          startsAt,
        },
      },
      update: {
        title: sessionTitle,
        durationMinutes,
        capacity,
        ...(isSpecialClass ? { location: SPECIAL_SALSA_CLASS.address } : {}),
      },
      create: {
        courseSlug: input.courseSlug,
        title: sessionTitle,
        startsAt,
        durationMinutes,
        capacity,
        ...(isSpecialClass ? { location: SPECIAL_SALSA_CLASS.address } : {}),
      },
    })

    let attendance = await tx.attendance.findUnique({
      where: {
        userId_sessionId: {
          userId: input.userId,
          sessionId: session.id,
        },
      },
    })

    if (!attendance) {
      attendance = await tx.attendance.create({
        data: {
          userId: input.userId,
          sessionId: session.id,
          status: preferredStatus,
          checkedInAt: startsAt,
          metadata: {
            source,
            purchaseId: input.purchaseId,
          },
        },
      })
    } else {
      const metadata = (attendance.metadata || {}) as Record<string, unknown>
      const existingPurchaseId = typeof metadata.purchaseId === "string" ? metadata.purchaseId : null
      const needsPurchaseLink = !existingPurchaseId
      const needsStatusUpgrade = shouldUpgradeStatus(attendance.status)

      if (needsPurchaseLink || needsStatusUpgrade) {
        attendance = await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            ...(needsStatusUpgrade ? { status: preferredStatus, checkedInAt: startsAt } : {}),
            ...(needsPurchaseLink
              ? {
                  metadata: {
                    ...metadata,
                    source,
                    purchaseId: input.purchaseId,
                  },
                }
              : {}),
          },
        })
      }
    }

    if (input.packagePurchaseId) {
      try {
        await reservePackageCreditForAttendanceTx(tx, {
          packagePurchaseId: input.packagePurchaseId,
          userId: input.userId,
          attendanceId: attendance.id,
          courseSlug: input.courseSlug,
          at: startsAt,
          reason: "PACKAGE_INITIAL_BOOKING",
        })
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          console.error("Failed to reserve package credit for purchase booking", error)
        }
      }
    }

    return { session, attendance }
  })
}
