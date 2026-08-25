import { describe, it, expect, vi, beforeEach } from "vitest"
import { calculateTeacherClockOut } from "@/lib/clock/teacher-clock"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseCatalog: {
      findMany: vi.fn()
    },
    staffAccount: {
      findUnique: vi.fn()
    },
    staffClockEntry: {
      findFirst: vi.fn(),
      create: vi.fn()
    }
  }
}))

describe("teacher-clock", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe("calculateTeacherClockOut", () => {
    it("should return clockInAt and 0 minutes if no course slugs provided", async () => {
      const clockInAt = new Date("2026-04-03T10:00:00.000Z")
      
      const result = await calculateTeacherClockOut([], clockInAt)
      
      expect(result.totalMinutes).toBe(0)
      expect(result.expectedClockOutAt).toEqual(clockInAt)
      expect(result.matchedSlugs).toEqual([])
    })

    it("should calculate correctly based on found courses matching today's weekday", async () => {
      const clockInAt = new Date("2026-04-03T10:00:00.000Z") // Friday (5)
      
      vi.mocked(prisma.courseCatalog.findMany).mockResolvedValue([
        { id: "1", slug: "yoga-basics", durationMinutes: 60 },
        { id: "2", slug: "pilates-pro", durationMinutes: 45 },
      ] as unknown as Awaited<ReturnType<typeof prisma.courseCatalog.findMany>>)

      const result = await calculateTeacherClockOut(["yoga-basics", "pilates-pro"], clockInAt)
      
      expect(prisma.courseCatalog.findMany).toHaveBeenCalledWith({
        where: {
          slug: { in: ["yoga-basics", "pilates-pro"] },
          active: true,
          availableWeekdays: { has: 5 }
        }
      })
      
      expect(result.totalMinutes).toBe(105)
      expect(result.matchedSlugs).toEqual(["yoga-basics", "pilates-pro"])
      
      const expectedOut = new Date(clockInAt.getTime() + 105 * 60000)
      expect(result.expectedClockOutAt).toEqual(expectedOut)
    })
  })
})