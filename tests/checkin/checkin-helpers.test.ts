import { describe, expect, it } from "vitest"
import type { CourseData } from "@/constants/courses"
import { pickTerminalContextRecommendation } from "@/lib/checkin/checkin-helpers"

const createCourse = (overrides: Partial<CourseData>): CourseData => ({
  slug: "salsa-nocturno",
  title: "Salsa Nocturno",
  description: "Test course",
  level: "Beginner",
  duration: "60 min",
  schedule: {
    day: "Thursday",
    time: "8:10 PM",
    starts: "2026-04-02",
    availableWeekdays: [3],
    availableTimes: ["20:10"],
  },
  location: { address: "Studio" },
  instructors: [{ name: "PLI Team" }],
  enrollment: {
    services: [{ id: "drop-in", label: "Drop-in", price: 25 }],
    packages: [],
  },
  ...overrides,
})

describe("pickTerminalContextRecommendation", () => {
  it("keeps terminal recommendations capped to today's preferred class", () => {
    const courses = [
      createCourse({
        slug: "zumba-matutino",
        title: "Zumba Matutino",
        schedule: {
          day: "Monday",
          time: "10:00 AM",
          starts: "2026-04-06",
          availableWeekdays: [0],
          availableTimes: ["10:00"],
        },
      }),
    ]

    const result = pickTerminalContextRecommendation(
      courses,
      new Date("2026-04-02T18:00:00.000Z"),
      "zumba-matutino",
      { todayOnly: true },
    )

    expect(result).toBeNull()
  })

  it("allows staff to charge today's preferred class after it ended", () => {
    const courses = [createCourse({})]

    const result = pickTerminalContextRecommendation(
      courses,
      new Date("2026-04-03T03:00:00.000Z"), // 11:00 PM ET on 2026-04-02
      "salsa-nocturno",
      { todayOnly: true },
    )

    expect(result).toEqual({
      courseSlug: "salsa-nocturno",
      date: "2026-04-02",
      time: "20:10",
    })
  })

  it("keeps legacy non-terminal lookahead behavior when todayOnly is not enabled", () => {
    const courses = [
      createCourse({
        slug: "zumba-matutino",
        title: "Zumba Matutino",
        schedule: {
          day: "Monday",
          time: "10:00 AM",
          starts: "2026-04-06",
          availableWeekdays: [0],
          availableTimes: ["10:00"],
        },
      }),
    ]

    const result = pickTerminalContextRecommendation(
      courses,
      new Date("2026-04-02T18:00:00.000Z"),
      "zumba-matutino",
    )

    expect(result).toEqual({
      courseSlug: "zumba-matutino",
      date: "2026-04-06",
      time: "10:00",
    })
  })
})
