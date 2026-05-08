import { describe, expect, it } from "vitest"
import type { CourseData } from "@/constants/courses"
import { pickLatePaymentRecommendation } from "@/lib/checkin/checkin-helpers"

const makeCourse = (slug: string, time: string): CourseData => ({
  slug,
  title: slug,
  description: "Test course",
  level: "Beginner",
  duration: "60 min",
  schedule: {
    day: "Friday",
    time,
    starts: time,
    availableWeekdays: [4],
    availableTimes: [time],
  },
  location: {
    address: "Test studio",
  },
  instructors: [],
  enrollment: {
    services: [],
    packages: [],
  },
})

describe("terminal late payment window", () => {
  const courses = [
    makeCourse("first-class", "19:10"),
    makeCourse("second-class", "20:10"),
  ]

  it("keeps the previous class payment banner available for 15 minutes after class end", () => {
    expect(pickLatePaymentRecommendation(courses, new Date(2026, 4, 8, 20, 25))).toEqual({
      courseSlug: "first-class",
      date: "2026-05-08",
      time: "19:10",
    })
  })

  it("hides the previous class payment banner after the 30 minute rotation window ends", () => {
    expect(pickLatePaymentRecommendation(courses, new Date(2026, 4, 8, 20, 26))).toBeNull()
  })
})
