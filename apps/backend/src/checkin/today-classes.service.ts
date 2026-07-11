import { buildTodayTerminalClasses, type TerminalCourseCatalogLike } from "@/lib/checkin/terminal-current-class"
import { prisma } from "@/lib/prisma"
import { createCheckinTodayClassesResponse, type CheckinTodayClassesResponse } from "@/lib/nest-gateway/contracts/checkin-today-classes"

const findActiveCourses = async (): Promise<TerminalCourseCatalogLike[]> => {
  return prisma.courseCatalog.findMany({
    where: { active: true },
    orderBy: [{ createdAt: "asc" }],
    take: 100,
  })
}

export class TodayClassesService {
  constructor(private readonly loadActiveCourses: () => Promise<TerminalCourseCatalogLike[]> = findActiveCourses) {}

  async getTodayClasses(now = new Date()): Promise<CheckinTodayClassesResponse> {
    const activeCourses = await this.loadActiveCourses()
    const classes = buildTodayTerminalClasses(activeCourses, now)

    return createCheckinTodayClassesResponse({ classes, now })
  }
}
