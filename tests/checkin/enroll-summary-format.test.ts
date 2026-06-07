import { describe, expect, it } from "vitest"
import { computeCheckInAutofill, formatCheckInSummaryDateTime } from "@/components/front/courses/EnrollModal"
import type { CourseData } from "@/constants/courses"

const testCourses: CourseData[] = [
  {
    slug: "salsa-timba-in-new-york",
    title: "Salsa timba in New York",
    description: "",
    level: "Beginner",
    duration: "60 min",
    schedule: {
      day: "Wednesday",
      time: "22:00",
      starts: "2026-01-01",
      availableWeekdays: [2],
      availableTimes: ["22:00"],
    },
    location: { address: "Palladium" },
    instructors: [],
    enrollment: {
      services: [{ id: "drop-in", label: "Drop-in", price: 29 }],
      packages: [],
    },
  },
]

describe("enroll summary date formatting", () => {
  it("formats terminal date and time in human-readable english", () => {
    expect(formatCheckInSummaryDateTime("2026-03-20", "20:10")).toBe("Friday, March 20 · 8:10 PM")
  })

  it("keeps kiosk check-in context date/time instead of rotating to next week", () => {
    const result = computeCheckInAutofill(
      "salsa-timba-in-new-york",
      testCourses,
      { date: "2026-05-06", time: "22:00" },
      new Date("2026-05-06T23:10:00-04:00")
    )

    expect(result).toMatchObject({
      date: "2026-05-06",
      time: "22:00",
    })
  })
})
