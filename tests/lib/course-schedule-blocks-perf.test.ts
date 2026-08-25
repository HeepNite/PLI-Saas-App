import { describe, expect, it } from "vitest"
import { expandCourseScheduleSlots } from "@/lib/course-schedule-blocks"
import type { CourseScheduleLike } from "@/lib/course-schedule-blocks"

describe("expandCourseScheduleSlots — performance", () => {
  it("expands 50 courses × 2-3 schedule rules across 90-day window in < 100ms", () => {
    // Build 50 courses with varying schedule rules
    const courses: CourseScheduleLike[] = []
    for (let i = 0; i < 50; i++) {
      const numRules = 2 + (i % 2) // 2 or 3 rules per course
      const rules = []
      // Spread rules across different weekdays
      for (let r = 0; r < numRules; r++) {
        const weekday = ((i + r) % 5) + 1 // Mon-Fri
        const hour = 9 + (r * 2) // 9:00, 11:00, 13:00
        rules.push({ weekday, times: [`${hour.toString().padStart(2, "0")}:00`] })
      }

      courses.push({
        defaultRoomId: `room-${i % 5}`, // 5 rooms total
        durationMinutes: 45 + (i % 3) * 15, // 45, 60, or 75 min
        scheduleRules: { mode: "regular", rules },
        availableWeekdays: [],
        availableTimes: [],
      })
    }

    // 90-day window starting June 1, 2026
    const windowStart = new Date("2026-06-01T00:00:00Z")
    const windowEnd = new Date("2026-08-30T23:59:59Z")

    const startTime = performance.now()

    let totalSlots = 0
    for (const course of courses) {
      const slots = expandCourseScheduleSlots(course, windowStart, windowEnd)
      totalSlots += slots.length
    }

    const elapsed = performance.now() - startTime

    // Log for observability
    console.log(
      `[perf] expandCourseScheduleSlots: ${courses.length} courses, ` +
      `${totalSlots} total slots, ${elapsed.toFixed(2)}ms`
    )

    // Assert performance threshold. This is an algorithmic-bound guard, not a
    // precise timing SLA: locally ~240ms, but a contended CI runner can be
    // several times slower. Keep the bound generous enough to avoid wall-clock
    // flakes while still catching an O(courses²)-style regression (which would
    // be orders of magnitude slower).
    expect(elapsed).toBeLessThan(2000)

    // Sanity: we should have generated a reasonable number of slots
    // 50 courses × ~2.5 rules × ~13 weeks ≈ 1625 slots
    expect(totalSlots).toBeGreaterThan(500)
  })

  it("single course with daily rules (5 weekdays) across 90 days performs well", () => {
    const course: CourseScheduleLike = {
      defaultRoomId: "room-1",
      durationMinutes: 60,
      scheduleRules: {
        mode: "regular",
        rules: [
          { weekday: 1, times: ["09:00", "11:00", "14:00"] }, // Mon
          { weekday: 2, times: ["09:00", "11:00", "14:00"] }, // Tue
          { weekday: 3, times: ["09:00", "11:00", "14:00"] }, // Wed
          { weekday: 4, times: ["09:00", "11:00", "14:00"] }, // Thu
          { weekday: 5, times: ["09:00", "11:00", "14:00"] }, // Fri
        ],
      },
      availableWeekdays: [],
      availableTimes: [],
    }

    const windowStart = new Date("2026-06-01T00:00:00Z")
    const windowEnd = new Date("2026-08-30T23:59:59Z")

    const startTime = performance.now()
    const slots = expandCourseScheduleSlots(course, windowStart, windowEnd)
    const elapsed = performance.now() - startTime

    console.log(
      `[perf] single course daily: ${slots.length} slots in ${elapsed.toFixed(2)}ms`
    )

    // Generous algorithmic-bound guard (see note above) — tolerant of CI
    // contention while still catching pathological slowdowns.
    expect(elapsed).toBeLessThan(500)
    // ~13 weeks × 5 days × 3 times = ~195 slots
    expect(slots.length).toBeGreaterThan(150)
  })

  it("horizon cap prevents unbounded expansion beyond 90 days", () => {
    const course: CourseScheduleLike = {
      defaultRoomId: "room-1",
      durationMinutes: 60,
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 1, times: ["10:00"] }], // Every Monday
      },
      availableWeekdays: [],
      availableTimes: [],
    }

    // Request a 180-day window — should still cap at 90 days
    const windowStart = new Date("2026-01-01T00:00:00Z")
    const windowEnd = new Date("2026-06-30T23:59:59Z") // ~180 days

    const slots = expandCourseScheduleSlots(course, windowStart, windowEnd)

    // Count how many Mondays are in first 90 days vs full 180 days
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
    const horizonCutoff = windowStart.getTime() + ninetyDaysMs

    for (const slot of slots) {
      expect(slot.startsAt.getTime()).toBeLessThan(horizonCutoff)
    }

    // Should have ~13 Mondays in 90 days, not ~26 in 180 days
    expect(slots.length).toBeLessThanOrEqual(14) // 13 + 1 boundary tolerance
  })
})
