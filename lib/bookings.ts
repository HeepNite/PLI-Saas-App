import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt, getCourseBySlug } from "@/lib/class-schedule"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"

const DEFAULT_DURATION_MINUTES = 60
export const DEFAULT_CLASS_CAPACITY = 12
export const ACTIVE_BOOKING_STATUSES = ["scheduled", "checked_in", "checked_in_no_package"]

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
}) => {
  const date = input.date?.trim()
  const time = input.time?.trim()
  if (!date || !time) return null

  const startsAt = buildSessionStartsAt(date, time)
  if (!startsAt) return null

  const course = getCourseBySlug(input.courseSlug)
  const sessionTitle = course?.title || input.courseTitle || input.courseSlug

  return prisma.$transaction(async (tx) => {
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
          status: "scheduled",
          checkedInAt: startsAt,
          metadata: {
            source: "purchase_booking",
            purchaseId: input.purchaseId,
          },
        },
      })
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
