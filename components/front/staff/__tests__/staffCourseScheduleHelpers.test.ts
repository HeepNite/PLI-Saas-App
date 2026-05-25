import { describe, expect, it } from "vitest"

import {
  buildSlotsFromScheduleRules,
  normalizeCourseScheduleRules,
} from "@/components/front/staff/staffCourseScheduleHelpers"

describe("normalizeCourseScheduleRules", () => {
  it("returns null when there is no usable schedule or publication metadata", () => {
    expect(normalizeCourseScheduleRules(null)).toBeNull()
    expect(normalizeCourseScheduleRules({ rules: [], specialEvents: [] })).toBeNull()
    expect(
      normalizeCourseScheduleRules({
        rules: [{ weekday: 8, times: ["25:99"] }],
        specialEvents: [{ date: "not-a-date", times: ["10:00"] }],
      })
    ).toBeNull()
  })

  it("normalizes recurring rules by grouping weekdays and deduplicating valid times", () => {
    expect(
      normalizeCourseScheduleRules({
        rules: [
          { weekday: 3, times: ["9:00", "09:00", "bad"] },
          { weekday: 1, times: ["18:30"] },
          { weekday: 3, times: ["10:15"] },
        ],
      })
    ).toMatchObject({
      mode: "regular",
      weeklyDaysTarget: 2,
      rules: [
        { weekday: 1, times: ["18:30"] },
        { weekday: 3, times: ["09:00", "10:15"] },
      ],
      specialEvents: [],
      publication: { mode: "publish_now", launchDate: null },
      specialDiscount: { type: "none", label: null, priceCents: null },
    })
  })

  it("preserves special event mode and valid publication/discount metadata", () => {
    expect(
      normalizeCourseScheduleRules({
        mode: "special_event",
        repeatAllMonth: false,
        recurrenceMode: "until_date",
        recurrenceEndsAt: "2026-04-30",
        weeklyDaysTarget: 9,
        specialEvents: [
          { date: "2026-04-10", times: ["20:00", "8:00 PM"] },
          { date: "2026-04-09", times: ["19:30"] },
        ],
        publication: { mode: "launch_date", launchDate: "2026-04-01" },
        specialDiscount: { type: "custom", label: "Launch offer", priceCents: 1234.6 },
      })
    ).toMatchObject({
      mode: "special_event",
      weeklyDaysTarget: 7,
      repeatAllMonth: false,
      recurrenceMode: "until_date",
      recurrenceEndsAt: "2026-04-30",
      rules: [],
      specialEvents: [
        { date: "2026-04-09", times: ["19:30"], label: "Special event" },
        { date: "2026-04-10", times: ["20:00"], label: "Special event" },
      ],
      publication: { mode: "launch_date", launchDate: "2026-04-01" },
      specialDiscount: { type: "custom", label: "Launch offer", priceCents: 1235 },
    })
  })
})

describe("buildSlotsFromScheduleRules", () => {
  it("turns normalized rules and special events into sorted course slots", () => {
    const payload = normalizeCourseScheduleRules({
      rules: [{ weekday: 5, times: ["18:00"] }],
      specialEvents: [{ date: "2026-04-01", times: ["12:00"] }],
    })

    expect(payload).not.toBeNull()
    expect(buildSlotsFromScheduleRules(payload!)).toEqual([
      { date: "2026-04-01", time: "12:00" },
      { weekday: 5, recurring: true, time: "18:00" },
    ])
  })
})
