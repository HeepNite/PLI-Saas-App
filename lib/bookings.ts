import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt, getCourseBySlug } from "@/lib/class-schedule"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"

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
  const date = input.date?.trim()
  const time = input.time?.trim()
  if (!date || !time) return null

  const startsAt = buildSessionStartsAt(date, time)
  if (!startsAt) return null

  const course = getCourseBySlug(input.courseSlug)
  const sessionTitle = course?.title || input.courseTitle || input.courseSlug
  const preferredStatus = input.preferredStatus || "scheduled"
  const source = input.source || "purchase_booking"

  const shouldUpgradeStatus = (current: string) => {
    if (preferredStatus === "checked_in") return current === "scheduled"
    if (preferredStatus === "checked_in_no_package") return current === "scheduled"
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
        durationMinutes: DEFAULT_DURATION_MINUTES,
        capacity: DEFAULT_CLASS_CAPACITY,
      },
      create: {
        courseSlug: input.courseSlug,
        title: sessionTitle,
        startsAt,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        capacity: DEFAULT_CLASS_CAPACITY,
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
