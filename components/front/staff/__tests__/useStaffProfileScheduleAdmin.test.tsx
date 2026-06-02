// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffProfileScheduleAdmin } from "@/components/front/staff/useStaffProfileScheduleAdmin"
import type { AssignmentCourseOption, SelfProfileSnapshot } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffProfileScheduleAdmin>

const profile = (overrides: Partial<SelfProfileSnapshot> = {}): SelfProfileSnapshot => ({
  firstName: "Ada",
  lastName: "Teacher",
  imageUrl: "",
  location: "Studio A",
  role: "staff",
  category: "teacher",
  paymentPreference: null,
  assignedPaymentPreference: null,
  paymentInfo: null,
  metrics: {
    performanceRating: null,
    performanceReviewsCount: null,
    performanceReviewCycleDays: null,
    payrollHoursWorked: null,
    payrollHourlyRate: null,
    payrollStatus: null,
    payrollPaydayWeekday: null,
  },
  presence: {
    online: false,
    authOnline: false,
    lastSignInAt: null,
    staffLastCheckInAt: null,
    status: null,
  },
  teaching: {
    teacherCourseSlugs: ["bachata"],
    teacherWeekdays: [1],
    teacherShiftStart: "09:00",
    teacherShiftEnd: "10:30",
  },
  ...overrides,
})

const courseOptions: AssignmentCourseOption[] = [
  { slug: "bachata", title: "Bachata Basics", description: null, imageUrl: null, scheduleLabel: null, kindLabel: null },
]

function HookHarness({ onState, resolvedSelfProfile = profile() }: { onState: (state: HookState) => void; resolvedSelfProfile?: SelfProfileSnapshot }) {
  const state = useStaffProfileScheduleAdmin({ resolvedSelfProfile, courseOptions })
  onState(state)
  return <div>{state.selfScheduleEntries.length}</div>
}

describe("useStaffProfileScheduleAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.useRealTimers()
  })

  async function renderHookHarness(resolvedSelfProfile?: SelfProfileSnapshot) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness resolvedSelfProfile={resolvedSelfProfile} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("builds profile calendar entries from teaching weekdays and course titles", async () => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"))
    const state = await renderHookHarness()

    expect(state.profileScheduleMonthLabel).toBe("June 2026")
    expect(state.selfScheduleEntries.length).toBeGreaterThan(0)
    expect(state.selfScheduleEntries[0]).toMatchObject({
      dateKey: "2026-06-01",
      title: "Bachata Basics",
      timeLabel: "9:00 AM - 10:30 AM",
    })
    expect(state.selfScheduleByDay["2026-06-01"]?.[0]?.title).toBe("Bachata Basics")
  })

  it("falls back to one-hour entries when shift end is missing", async () => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"))
    const state = await renderHookHarness(profile({ teaching: { teacherCourseSlugs: ["unknown"], teacherWeekdays: [1], teacherShiftStart: "09:00", teacherShiftEnd: "" } }))

    expect(state.selfScheduleEntries[0]?.title).toBe("unknown")
    expect(state.selfScheduleEntries[0]?.timeLabel).toBe("9:00 AM - 10:00 AM")
  })

  it("falls back to Staff shift when no course title is available", async () => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"))
    const state = await renderHookHarness(profile({ teaching: { teacherCourseSlugs: [], teacherWeekdays: [1], teacherShiftStart: "09:00", teacherShiftEnd: "10:00" } }))

    expect(state.selfScheduleEntries[0]?.title).toBe("Staff shift")
  })

  it("returns disabled calendar links when teaching schedule is incomplete", async () => {
    const state = await renderHookHarness(profile({ teaching: { teacherCourseSlugs: [], teacherWeekdays: [], teacherShiftStart: "", teacherShiftEnd: "" } }))

    expect(state.selfScheduleEntries).toEqual([])
    expect(state.selfCalendarGoogleHref).toBe("#")
    expect(state.selfCalendarIcsDataUri).toBe("#")
  })

  it("builds Google and ICS calendar exports for schedule entries", async () => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"))
    const state = await renderHookHarness()

    expect(state.selfCalendarGoogleHref).toContain("calendar.google.com")
    expect(state.selfCalendarGoogleHref).toContain("Bachata+Basics")
    expect(new URL(state.selfCalendarGoogleHref).searchParams.get("dates")).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    const decodedIcs = decodeURIComponent(state.selfCalendarIcsDataUri.replace("data:text/calendar;charset=utf-8,", ""))
    expect(decodedIcs).toContain("BEGIN:VCALENDAR")
    expect(decodedIcs).toContain("SUMMARY:Bachata Basics")
    expect(decodedIcs).toContain("LOCATION:Studio A")
    expect(decodedIcs).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
    expect(decodedIcs).toMatch(/DTSTART:\d{8}T\d{6}Z/)
    expect(decodedIcs).toMatch(/DTEND:\d{8}T\d{6}Z/)
  })
})
