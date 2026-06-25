import "server-only"

import { prisma } from "@/lib/prisma"
import { getStartOfDayNY } from "@/lib/class-schedule"
import { ATTENDANCE_POINT_STATUSES as ATTENDANCE_CHECKED_IN_STATUSES } from "@/lib/attendance-constants"

/**
 * Check if a user has attended a specific course today (America/New_York timezone).
 *
 * Uses the same day-boundary logic as the rest of the codebase (getStartOfDayNY)
 * to handle EDT/EST transitions correctly.
 */
export const hasAttendedCourseToday = async (
  userId: string,
  courseSlug: string,
  now = new Date()
): Promise<boolean> => {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now)

  const dayStart = getStartOfDayNY(todayKey)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const attendance = await prisma.attendance.findFirst({
    where: {
      userId,
      status: { in: [...ATTENDANCE_CHECKED_IN_STATUSES] },
      session: {
        courseSlug: courseSlug.trim().toLowerCase(),
        startsAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    },
  })

  return attendance !== null
}

/**
 * Check if a user already has a purchase for a specific course session today.
 * Used to suppress consecutive offers when the student already bought Class B.
 */
export const hasPurchaseForCourseToday = async (
  userId: string,
  courseSlug: string,
  now = new Date()
): Promise<boolean> => {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now)

  const dayStart = getStartOfDayNY(todayKey)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      courseSlug: courseSlug.trim().toLowerCase(),
      status: { in: ["paid", "succeeded", "completed"] },
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })

  return purchase !== null
}
