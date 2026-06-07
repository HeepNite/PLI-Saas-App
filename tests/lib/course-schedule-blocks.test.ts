import { describe, expect, it } from "vitest"
import { expandCourseScheduleSlots } from "@/lib/course-schedule-blocks"

describe("expandCourseScheduleSlots", () => {
  const makeCourse = (overrides: Partial<Parameters<typeof expandCourseScheduleSlots>[0]> = {}) => ({
    scheduleRules: null,
    availableWeekdays: [] as number[],
    availableTimes: [] as string[],
    defaultRoomId: null as string | null,
    durationMinutes: null as number | null,
    ...overrides,
  })

  // Tuesday June 2, 2026 in America/New_York = UTC-4 (EDT)
  // Tuesday Jan 6, 2026 in America/New_York = UTC-5 (EST)

  it("single rule 'weekday 2 (Tue), time 10:00' → projects correct UTC dates for Tuesdays", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      durationMinutes: 60,
    })

    // Window: June 1-8, 2026 (covers Tuesday June 2)
    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-08T23:59:59Z")
    )

    expect(slots).toHaveLength(1)
    // Tuesday June 2, 2026 10:00 AM EDT = 14:00 UTC
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-02T14:00:00.000Z")
    expect(slots[0].endsAt.toISOString()).toBe("2026-06-02T15:00:00.000Z")
  })

  it("multiple rules → all weekdays expanded", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [
          { weekday: 2, times: ["10:00"] }, // Tuesday
          { weekday: 4, times: ["14:00"] }, // Thursday
        ],
      },
      durationMinutes: 60,
    })

    // Window: June 1-5, 2026 (Mon-Fri, covers Tue June 2 and Thu June 4)
    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-05T23:59:59Z")
    )

    expect(slots).toHaveLength(2)
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-02T14:00:00.000Z") // Tue 10:00 EDT
    expect(slots[1].startsAt.toISOString()).toBe("2026-06-04T18:00:00.000Z") // Thu 14:00 EDT
  })

  it("respects window boundaries (no slots outside windowStart-windowEnd)", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      durationMinutes: 60,
    })

    // Window: June 3-9 (Wednesday to Tuesday, but Tuesday June 2 is BEFORE window)
    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-03T00:00:00Z"),
      new Date("2026-06-09T23:59:59Z")
    )

    // Next Tuesday is June 9, which IS in the window
    expect(slots).toHaveLength(1)
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-09T14:00:00.000Z")
  })

  it("horizon cap at 90 days", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 1, times: ["10:00"] }], // Every Monday
      },
      durationMinutes: 60,
    })

    // Request a 120-day window
    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-09-30T23:59:59Z") // ~120 days
    )

    // Should only return slots within first 90 days from windowStart
    const ninetyDaysLater = new Date("2026-06-01T00:00:00Z").getTime() + 90 * 24 * 60 * 60 * 1000
    for (const slot of slots) {
      expect(slot.startsAt.getTime()).toBeLessThan(ninetyDaysLater)
    }
  })

  it("default duration 60min when course.durationMinutes is null", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      durationMinutes: null,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-02T00:00:00Z"),
      new Date("2026-06-02T23:59:59Z")
    )

    expect(slots).toHaveLength(1)
    const duration = slots[0].endsAt.getTime() - slots[0].startsAt.getTime()
    expect(duration).toBe(60 * 60 * 1000) // 60 minutes
  })

  it("custom duration respected", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      durationMinutes: 90,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-02T00:00:00Z"),
      new Date("2026-06-02T23:59:59Z")
    )

    expect(slots).toHaveLength(1)
    const duration = slots[0].endsAt.getTime() - slots[0].startsAt.getTime()
    expect(duration).toBe(90 * 60 * 1000) // 90 minutes
  })

  it("DST transition: Tuesday 10:00 America/New_York → correct UTC offset in EST vs EDT", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      durationMinutes: 60,
    })

    // June 2, 2026 = EDT (UTC-4) → 10:00 EDT = 14:00 UTC
    const edtSlots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-02T00:00:00Z"),
      new Date("2026-06-02T23:59:59Z")
    )
    expect(edtSlots[0].startsAt.toISOString()).toBe("2026-06-02T14:00:00.000Z")

    // Jan 6, 2026 = EST (UTC-5) → 10:00 EST = 15:00 UTC
    const estSlots = expandCourseScheduleSlots(
      course,
      new Date("2026-01-06T00:00:00Z"),
      new Date("2026-01-06T23:59:59Z")
    )
    expect(estSlots[0].startsAt.toISOString()).toBe("2026-01-06T15:00:00.000Z")
  })

  it("empty scheduleRules → falls back to availableWeekdays + availableTimes", () => {
    const course = makeCourse({
      scheduleRules: null,
      availableWeekdays: [2], // Tuesday (JS getDay)
      availableTimes: ["10:00"],
      durationMinutes: 60,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-08T23:59:59Z")
    )

    expect(slots).toHaveLength(1)
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-02T14:00:00.000Z")
  })

  it("no scheduleRules AND no availableWeekdays → returns empty array", () => {
    const course = makeCourse({
      scheduleRules: null,
      availableWeekdays: [],
      availableTimes: ["10:00"],
      durationMinutes: 60,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-08T23:59:59Z")
    )

    expect(slots).toHaveLength(0)
  })

  it("course without defaultRoomId → still expands (caller filters)", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00"] }],
      },
      defaultRoomId: null,
      durationMinutes: 60,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-02T00:00:00Z"),
      new Date("2026-06-02T23:59:59Z")
    )

    // Should still expand — filtering by roomId is the caller's responsibility
    expect(slots).toHaveLength(1)
  })

  it("multiple times per rule → all times expanded", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [{ weekday: 2, times: ["10:00", "11:30", "14:00"] }],
      },
      durationMinutes: 60,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-02T00:00:00Z"),
      new Date("2026-06-02T23:59:59Z")
    )

    expect(slots).toHaveLength(3)
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-02T14:00:00.000Z")
    expect(slots[1].startsAt.toISOString()).toBe("2026-06-02T15:30:00.000Z")
    expect(slots[2].startsAt.toISOString()).toBe("2026-06-02T18:00:00.000Z")
  })

  it("slots sorted by startsAt", () => {
    const course = makeCourse({
      scheduleRules: {
        mode: "regular",
        rules: [
          { weekday: 4, times: ["14:00"] }, // Thursday
          { weekday: 2, times: ["10:00"] }, // Tuesday
        ],
      },
      durationMinutes: 60,
    })

    const slots = expandCourseScheduleSlots(
      course,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-08T23:59:59Z")
    )

    expect(slots).toHaveLength(2)
    expect(slots[0].startsAt.getTime()).toBeLessThan(slots[1].startsAt.getTime())
  })
})
