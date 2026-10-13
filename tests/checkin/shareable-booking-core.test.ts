import { describe, expect, it } from "vitest"
import * as shareableBooking from "@/lib/checkin/shareable-booking"
import {
  buildShareableBookingOccurrences,
  classifyBookingClass,
  filterBookingOccurrences,
  getBookingFilterOptions,
  groupBookingOccurrencesByDate,
  type ShareableBookingOccurrence,
} from "@/lib/checkin/shareable-booking"
import type { CourseData } from "@/constants/courses"

const makeCourse = (overrides: Partial<CourseData> = {}): CourseData => ({
  slug: "salsa-timba",
  title: "Salsa Timba",
  category: null,
  description: "Class",
  level: "Beginner",
  duration: "60 min",
  schedule: {
    day: "Thu",
    time: "18:00 / 19:00",
    starts: "Ongoing",
    availableWeekdays: [3],
    availableTimes: ["18:00", "19:00"],
  },
  location: { address: "PLI" },
  instructors: [{ name: "PLI Team" }],
  heroMedia: { image: "/class.jpg" },
  enrollment: { services: [], packages: [] },
  scheduleRules: {
    rules: [{ weekday: 4, times: ["18:00", "19:00"] }],
    recurrenceEndsAt: null,
  },
  ...overrides,
})

const readyOccurrence: ShareableBookingOccurrence = {
  id: "salsa-timba:2026-06-11:19:00",
  slug: "salsa-timba",
  title: "Salsa Timba",
  category: null,
  level: "Beginner",
  durationMinutes: 60,
  date: "2026-06-11",
  monthKey: "2026-06",
  time: "19:00",
  classType: "salsa-cubana",
  coverImageUrl: "/class.jpg",
  instructorName: "PLI Team",
  bookingUrl: "/courses/salsa-timba?enroll=1&qrBooking=1&date=2026-06-11&time=19%3A00&durationMinutes=60",
}

describe("90-day public booking occurrences", () => {
  it("expands recurring schedules, excludes past slots, and stays inside 90 calendar days", () => {
    const occurrences = buildShareableBookingOccurrences(
      [makeCourse()],
      new Date("2026-06-11T18:30:00-04:00")
    )

    expect(occurrences[0]).toMatchObject({ date: "2026-06-11", time: "19:00", instructorName: "PLI Team" })
    expect(occurrences.some(({ date, time }) => date === "2026-06-11" && time === "18:00")).toBe(false)
    expect(occurrences.every(({ date }) => date >= "2026-06-11" && date <= "2026-09-08")).toBe(true)
    expect(occurrences.at(-1)?.date).toBe("2026-09-03")
  })

  it("orders equal slots deterministically and excludes malformed times", () => {
    const occurrences = buildShareableBookingOccurrences(
      [
        makeCourse({ slug: "z-salsa", title: "Zulu Salsa" }),
        makeCourse({
          slug: "a-bachata",
          title: "Alpha Bachata",
          scheduleRules: { rules: [{ weekday: 4, times: ["19:00", "25:00"] }] },
        }),
      ],
      new Date("2026-06-11T16:00:00-04:00")
    )

    expect(occurrences.slice(0, 3).map(({ date, time, title }) => `${date}:${time}:${title}`)).toEqual([
      "2026-06-11:18:00:Zulu Salsa",
      "2026-06-11:19:00:Alpha Bachata",
      "2026-06-11:19:00:Zulu Salsa",
    ])
    expect(occurrences.some(({ time }) => time === "25:00")).toBe(false)
  })

  it("honors recurrence end dates", () => {
    const occurrences = buildShareableBookingOccurrences(
      [makeCourse({ scheduleRules: { rules: [{ weekday: 4, times: ["19:00"] }], recurrenceEndsAt: "2026-06-25" } })],
      new Date("2026-06-11T16:00:00-04:00")
    )

    expect(occurrences.map(({ date }) => date)).toEqual(["2026-06-11", "2026-06-18", "2026-06-25"])
  })

  it("builds the canonical future QR booking handoff", () => {
    const occurrence = buildShareableBookingOccurrences(
      [makeCourse()],
      new Date("2026-06-11T16:00:00-04:00")
    ).find(({ date, time }) => date === "2026-06-18" && time === "19:00")

    expect(occurrence?.bookingUrl).toBe(
      "/courses/salsa-timba?enroll=1&qrBooking=1&date=2026-06-18&time=19%3A00&durationMinutes=60"
    )
  })

  it("exposes only occurrence- and public-channel-applicable promotion labels", () => {
    const course = makeCourse({ scheduleRules: {
      rules: [{ weekday: 4, times: ["19:00"] }],
      promotions: [{
        id: "heritage", label: "Heritage pin benefit", active: true,
        pricing: { kind: "fixed", amountCents: 1500 },
        window: { basis: "class_date", startDate: "2026-06-11", endDate: "2026-06-18" },
        audience: "heritage_pin_delivered", channels: ["public_booking"],
      }],
    } })

    const occurrences = buildShareableBookingOccurrences([course], new Date("2026-06-11T16:00:00-04:00"))
    expect(occurrences.find(({ date }) => date === "2026-06-11")?.promotionLabels).toEqual(["Heritage pin benefit"])
    expect(occurrences.find(({ date }) => date === "2026-06-25")?.promotionLabels).toEqual([])
  })
})

describe("weekday booking routes", () => {
  it("configures all seven static routes and keeps every matching weekday occurrence regardless of promotions", () => {
    const now = new Date("2026-06-07T16:00:00-04:00")
    const courses = [
      makeCourse({
        slug: "monday-salsa",
        title: "Monday Salsa",
        scheduleRules: { rules: [{ weekday: 1, times: ["19:00"] }] },
      }),
      makeCourse({
        slug: "monday-bachata",
        title: "Monday Bachata",
        scheduleRules: {
          rules: [{ weekday: 1, times: ["20:00"] }],
          promotions: [{
            id: "expired", label: "Expired promotion", active: true,
            pricing: { kind: "fixed", amountCents: 1500 },
            window: { basis: "class_date", endDate: "2026-06-01" },
            audience: "heritage_pin_delivered", channels: ["public_booking"],
          }],
        },
      }),
      makeCourse({
        slug: "tuesday-salsa",
        title: "Tuesday Salsa",
        scheduleRules: { rules: [{ weekday: 2, times: ["19:00"] }] },
      }),
    ]
    const occurrences = buildShareableBookingOccurrences(courses, now)
    const api = shareableBooking as typeof shareableBooking & {
      WEEKDAY_BOOKING_ROUTES: readonly { path: string; weekday: number }[]
      filterBookingOccurrencesForWeekday: (
        occurrences: readonly ShareableBookingOccurrence[],
        weekday: number,
      ) => ShareableBookingOccurrence[]
    }

    expect(api.WEEKDAY_BOOKING_ROUTES).toEqual([
      { path: "/monday", weekday: 1 },
      { path: "/tuesday", weekday: 2 },
      { path: "/wednesday", weekday: 3 },
      { path: "/thursday", weekday: 4 },
      { path: "/friday", weekday: 5 },
      { path: "/saturday", weekday: 6 },
      { path: "/sunday", weekday: 0 },
    ])
    expect(api.filterBookingOccurrencesForWeekday(occurrences, 1).map(({ slug, date, time, promotionLabels }) => ({ slug, date, time, promotionLabels }))).toEqual([
      { slug: "monday-salsa", date: "2026-06-08", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-06-08", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-06-15", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-06-15", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-06-22", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-06-22", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-06-29", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-06-29", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-07-06", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-07-06", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-07-13", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-07-13", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-07-20", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-07-20", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-07-27", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-07-27", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-08-03", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-08-03", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-08-10", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-08-10", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-08-17", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-08-17", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-08-24", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-08-24", time: "20:00", promotionLabels: [] },
      { slug: "monday-salsa", date: "2026-08-31", time: "19:00", promotionLabels: [] },
      { slug: "monday-bachata", date: "2026-08-31", time: "20:00", promotionLabels: [] },
    ])
  })
})

describe("booking discovery filters", () => {
  it.each([
    [makeCourse({ title: "Beginner Bachata" }), "bachata"],
    [makeCourse({ title: "Mambo On2", slug: "mambo-on2" }), "salsa-on2"],
    [makeCourse({ title: "Beginner Rueda", slug: "rueda" }), "salsa-cubana"],
    [makeCourse({ title: "Contemporary", slug: "contemporary" }), "other"],
  ] as const)("classifies %s", (course, expected) => {
    expect(classifyBookingClass(course)).toBe(expected)
  })

  it("derives represented options, filters occurrences, and groups by date", () => {
    const occurrences: ShareableBookingOccurrence[] = [
      readyOccurrence,
      { ...readyOccurrence, id: "bachata", slug: "bachata", title: "Bachata", classType: "bachata", date: "2026-07-06", monthKey: "2026-07" },
      { ...readyOccurrence, id: "on2", slug: "on2", title: "Mambo On2", classType: "salsa-on2", date: "2026-07-07", monthKey: "2026-07" },
    ]

    expect(getBookingFilterOptions(occurrences)).toEqual({
      months: ["2026-06", "2026-07"],
      classTypes: ["salsa-cubana", "salsa-on2", "bachata"],
    })
    const filtered = filterBookingOccurrences(occurrences, "2026-07", "bachata", "bachata")
    expect(filtered.map(({ id }) => id)).toEqual(["bachata"])
    expect(filterBookingOccurrences(occurrences, "all", "all", "mambo on2").map(({ id }) => id)).toEqual(["on2"])
    expect(filterBookingOccurrences(occurrences, "all", "all", "cubana").map(({ id }) => id)).toEqual([readyOccurrence.id])
    expect(groupBookingOccurrencesByDate(occurrences).map(({ date, occurrences: items }) => [date, items.length])).toEqual([
      ["2026-06-11", 1],
      ["2026-07-06", 1],
      ["2026-07-07", 1],
    ])
  })
})
