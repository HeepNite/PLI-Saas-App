import { describe, expect, it } from "vitest"

import {
  buildTodayTerminalClasses,
  resolveCurrentTerminalClass,
} from "@/lib/checkin/terminal-current-class"

const course = (overrides: Record<string, unknown>) => ({
  slug: "salsa-beginner",
  title: "Salsa Beginner",
  category: "salsa",
  level: "beginner",
  durationMinutes: 60,
  availableWeekdays: [5],
  availableTimes: ["19:00"],
  scheduleRules: null,
  dropInPriceCents: 2000,
  firstClassPriceCents: 1000,
  coverImageUrl: null,
  ...overrides,
})

describe("terminal current class helpers", () => {
  it("builds today's ET classes from active catalog schedules", () => {
    const now = new Date("2026-06-19T22:00:00.000Z") // Friday ET

    const classes = buildTodayTerminalClasses([
      course({ slug: "wrong-day", availableWeekdays: [4] }),
      course({ slug: "right-day", availableTimes: ["20:00", "18:00"] }),
    ], now)

    expect(classes).toHaveLength(1)
    expect(classes[0]).toMatchObject({ slug: "right-day", date: "2026-06-19", availableTimes: ["18:00", "20:00"] })
  })

  it("uses scheduleRules before flat availableTimes", () => {
    const now = new Date("2026-06-19T22:00:00.000Z") // Friday ET, getDay=5

    const classes = buildTodayTerminalClasses([
      course({
        slug: "rules-course",
        availableWeekdays: [],
        availableTimes: ["18:00"],
        scheduleRules: { rules: [{ weekday: 5, times: ["21:00"] }] },
      }),
    ], now)

    expect(classes[0].availableTimes).toEqual(["21:00"])
  })

  it("projects today's published special class and replaces a matching catalog slot", () => {
    const now = new Date("2026-06-20T03:30:00.000Z") // Friday 11:30 PM ET

    const classes = buildTodayTerminalClasses([
      course({ slug: "salsa-special", availableTimes: ["19:00", "22:00"] }),
    ], now, [
      {
        slug: "special-salsa-night", status: "published", cancelledAt: null,
        title: "Special Salsa Night", coverImageUrl: "/special-salsa.jpg", priceCents: 3500, currency: "usd",
        classSession: { courseSlug: "salsa-special", startsAt: new Date("2026-06-20T02:00:00.000Z"), durationMinutes: 90 },
      },
      { slug: "draft", status: "draft", cancelledAt: null, title: "Draft", coverImageUrl: null, priceCents: 3500, currency: "usd", classSession: { courseSlug: "draft", startsAt: new Date("2026-06-20T01:00:00.000Z"), durationMinutes: 60 } },
      { slug: "cancelled", status: "published", cancelledAt: now, title: "Cancelled", coverImageUrl: null, priceCents: 3500, currency: "usd", classSession: { courseSlug: "cancelled", startsAt: new Date("2026-06-20T01:00:00.000Z"), durationMinutes: 60 } },
      { slug: "tomorrow", status: "published", cancelledAt: null, title: "Tomorrow", coverImageUrl: null, priceCents: 3500, currency: "usd", classSession: { courseSlug: "tomorrow", startsAt: new Date("2026-06-20T04:00:00.000Z"), durationMinutes: 60 } },
    ])

    expect(classes).toEqual([
      expect.objectContaining({ slug: "salsa-special", availableTimes: ["19:00"] }),
      expect.objectContaining({
        kind: "special",
        slug: "salsa-special",
        specialClassSlug: "special-salsa-night",
        title: "Special Salsa Night",
        availableTimes: ["22:00"],
        date: "2026-06-19",
        dropInPriceCents: 3500,
        currency: "usd",
      }),
    ])
  })

  it("resolves the same rotating current class as the terminal", () => {
    const now = new Date("2026-06-19T23:46:00.000Z") // 7:46 PM ET
    const classes = buildTodayTerminalClasses([
      course({ slug: "salsa", availableTimes: ["19:00"], durationMinutes: 60 }),
      course({ slug: "bachata", availableTimes: ["20:00"], durationMinutes: 60 }),
    ], now)

    const current = resolveCurrentTerminalClass(classes, now)

    expect(current?.slug).toBe("bachata")
    expect(current?.time).toBe("20:00")
  })
})
