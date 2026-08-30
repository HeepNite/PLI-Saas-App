import {
  buildTodayTerminalClasses,
  getTerminalDayRange,
  type TerminalCourseCatalogLike,
  type TerminalSpecialClassLike,
} from "@/lib/checkin/terminal-current-class"
import { prisma } from "@/lib/prisma"
import { createCheckinTodayClassesResponse, type CheckinTodayClassesResponse } from "@/lib/nest-gateway/contracts/checkin-today-classes"

const findActiveCourses = async (): Promise<TerminalCourseCatalogLike[]> => {
  return prisma.courseCatalog.findMany({
    where: { active: true },
    orderBy: [{ createdAt: "asc" }],
    take: 100,
  })
}

const findTodaySpecialClasses = async (now: Date): Promise<TerminalSpecialClassLike[]> => prisma.specialClass.findMany({
  where: {
    status: "published",
    cancelledAt: null,
    classSession: { startsAt: getTerminalDayRange(now) },
  },
  include: { classSession: true },
  orderBy: { classSession: { startsAt: "asc" } },
  take: 100,
})

export class TodayClassesService {
  constructor(
    private readonly loadActiveCourses: () => Promise<TerminalCourseCatalogLike[]> = findActiveCourses,
    private readonly loadTodaySpecialClasses: (now: Date) => Promise<TerminalSpecialClassLike[]> = findTodaySpecialClasses,
  ) {}

  async getTodayClasses(now = new Date()): Promise<CheckinTodayClassesResponse> {
    const [activeCourses, specialClasses] = await Promise.all([
      this.loadActiveCourses(),
      this.loadTodaySpecialClasses(now),
    ])
    const classes = buildTodayTerminalClasses(activeCourses, now, specialClasses)

    return createCheckinTodayClassesResponse({ classes, now })
  }
}
