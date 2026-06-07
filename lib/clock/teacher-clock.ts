import { prisma } from "@/lib/prisma"

export async function calculateTeacherClockOut(
  teacherCourseSlugs: string[],
  clockInAt: Date
): Promise<{ expectedClockOutAt: Date; totalMinutes: number; matchedSlugs: string[] }> {
  if (!teacherCourseSlugs || teacherCourseSlugs.length === 0) {
    return { expectedClockOutAt: clockInAt, totalMinutes: 0, matchedSlugs: [] }
  }

  const todayWeekday = clockInAt.getDay()

  const courses = await prisma.courseCatalog.findMany({
    where: {
      slug: { in: teacherCourseSlugs },
      active: true,
      availableWeekdays: {
        has: todayWeekday
      }
    }
  })

  let totalMinutes = 0
  const matchedSlugs: string[] = []

  for (const course of courses) {
    if (course.durationMinutes) {
      totalMinutes += course.durationMinutes
      matchedSlugs.push(course.slug)
    }
  }

  const expectedClockOutAt = new Date(clockInAt.getTime() + totalMinutes * 60000)

  return { expectedClockOutAt, totalMinutes, matchedSlugs }
}

export async function createTeacherClockEntryWithSlugs(
  clerkUserId: string,
  clockInAt: Date,
  teacherCourseSlugs: string[]
): Promise<{ created: boolean; entryId?: string; reason?: string }> {
  try {
    const staffAccount = await prisma.staffAccount.findUnique({
      where: { clerkUserId },
    })

    if (!staffAccount) {
      return { created: false, reason: "STAFF_ACCOUNT_NOT_FOUND" }
    }

    const startOfDay = new Date(clockInAt)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const existingEntry = await prisma.staffClockEntry.findFirst({
      where: {
        staffAccountId: staffAccount.id,
        clockInAt: {
          gte: startOfDay,
          lt: endOfDay,
        }
      }
    })

    if (existingEntry) {
      return { created: false, reason: "ALREADY_CLOCKED_IN_TODAY" }
    }

    const { expectedClockOutAt, totalMinutes, matchedSlugs } = await calculateTeacherClockOut(
      teacherCourseSlugs,
      clockInAt
    )

    const entry = await prisma.staffClockEntry.create({
      data: {
        staffAccountId: staffAccount.id,
        clockInAt,
        expectedClockOutAt,
        totalExpectedMinutes: totalMinutes,
        courseSlugs: matchedSlugs,
      }
    })

    return { created: true, entryId: entry.id }
  } catch (error) {
    console.error("[TeacherClock] Error creating clock entry:", error)
    return { created: false, reason: "INTERNAL_ERROR" }
  }
}