import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AssignClassesCard } from "@/components/front/profile/sections/AssignClassesCard"
import type { CourseData } from "@/constants/courses"

const buildProps = (): React.ComponentProps<typeof AssignClassesCard> => ({
  assignPackageId: "pkg-1",
  setAssignPackageId: vi.fn(),
  assignablePackages: [{
    id: "pkg-1",
    packageId: "starter",
    label: "Starter",
    courseSlug: "salsa-1",
    remainingCredits: 3,
    totalCredits: 5,
    isUnlimited: false,
    expiresAt: null,
  }],
  todayNyDateKey: "2026-10-01",
  assignDate: "2026-10-12",
  setAssignDate: vi.fn(),
  assignTime: "09:00",
  setAssignTime: vi.fn(),
  assignAvailability: [
    { time: "09:00", label: "9:00 AM", spotsLeft: 2, capacity: 8, isFull: false, isPast: false },
  ],
  assignAvailabilityLoading: false,
  assignSlots: [{ date: "2026-10-12", time: "09:00" }],
  assigning: false,
  assignError: null,
  setAssignError: vi.fn(),
  assignSuccess: null,
  setAssignSuccess: vi.fn(),
  selectedPackageForAssign: {
    id: "pkg-1",
    packageId: "starter",
    label: "Starter",
    courseSlug: "salsa-1",
    remainingCredits: 3,
    totalCredits: 5,
    isUnlimited: false,
    expiresAt: null,
  },
  selectedPackageCourse: {
    slug: "salsa-1",
    title: "Salsa 1",
    schedule: { day: "Monday", time: "9:00", availableWeekdays: [1] },
  } as CourseData,
  selectedPackageAssignmentStats: { assigned: 2, remaining: 1, queued: 1, isUnlimited: false },
  assignUnavailableDates: [],
  assignBookedTimesForSelectedDate: new Set<string>(),
  addAssignSlot: vi.fn(),
  removeAssignSlot: vi.fn(),
  submitAssignClasses: vi.fn(),
  agendaState: {
    mobileAgendaOpenDay: null,
    setMobileAgendaOpenDay: vi.fn(),
    agendaMonth: 9,
    setAgendaMonth: vi.fn(),
    agendaYear: 2026,
    setAgendaYear: vi.fn(),
    calendarDays: [],
    agendaMonthLabel: "October",
    agendaYears: [2025, 2026, 2027],
    bookingEventsByDay: new Map(),
    pendingBookingEventsByDay: new Map(),
    nextBookedClass: { scheduleLabel: "No upcoming class", courseTitle: "" },
  },
  pendingBookings: [],
  visibleBookings: [],
  classRequestsByAttendance: new Map(),
})

describe("AssignClassesCard", () => {
  it("renders package info, slot section and queued classes summary", () => {
    const html = renderToStaticMarkup(<AssignClassesCard {...buildProps()} />)

    expect(html).toContain("Assign classes")
    expect(html).toContain("Starter")
    expect(html).toContain("Classes to confirm")
    expect(html).toContain("You earn 2.5 points for assigning this package for the first time.")
  })

  it("renders scheduled and pending booking events inside the calendar", () => {
    const props = buildProps()
    props.visibleBookings = [{
      id: "attendance-1",
      status: "booked",
      startsAt: "2026-10-16T23:00:00.000Z",
      courseSlug: "salsa-timba",
      courseTitle: "Salsa Timba",
      sessionId: "session-1",
      packagePurchaseId: "purchase-1",
      packageLabel: "Starter",
    }]
    props.agendaState.calendarDays = [{ day: 16, isCurrent: true }]
    props.agendaState.bookingEventsByDay = new Map([
      [16, [
        { id: "attendance-1", time: "7:00 PM", courseTitle: "Salsa Timba" },
        { id: "attendance-3", time: "8:00 PM", courseTitle: "Bachata Moderna" },
        { id: "attendance-4", time: "9:00 PM", courseTitle: "Salsa Casino" },
      ]],
    ])
    props.agendaState.pendingBookingEventsByDay = new Map([
      [16, [{
        id: "attendance-2",
        time: "8:00 PM",
        courseTitle: "Bachata",
        processLabel: "Class change pending",
        processType: "CLASS_CHANGE",
      }]],
    ])
    props.agendaState.nextBookedClass = { scheduleLabel: "Friday, Oct 16, 7:00 PM", courseTitle: "Salsa Timba" }

    const html = renderToStaticMarkup(<AssignClassesCard {...props} />)

    expect(html).toContain("October 2026")
    expect(html).toContain("Salsa Timba")
    expect(html).toContain("Class 7:00 PM")
    expect(html).toContain("Bachata Moderna")
    expect(html).toContain("Salsa Casino")
    expect(html).toContain("Class change pending")
  })

  it("keeps every pending same-day booking discoverable in the calendar and mobile expansion", () => {
    const props = buildProps()
    props.agendaState.mobileAgendaOpenDay = 16
    props.agendaState.calendarDays = [{ day: 16, isCurrent: true }]
    props.agendaState.pendingBookingEventsByDay = new Map([[16, [
      {
        id: "pending-1",
        time: "7:00 PM",
        courseTitle: "Pending Alpha",
        processLabel: "Change Alpha pending",
        processType: "CLASS_CHANGE",
      },
      {
        id: "pending-2",
        time: "8:00 PM",
        courseTitle: "Pending Bravo",
        processLabel: "Change Bravo pending",
        processType: "CLASS_CHANGE",
      },
    ]]])
    props.pendingBookings = [
      {
        id: "pending-1",
        status: "booked",
        startsAt: "2026-10-16T23:00:00.000Z",
        courseSlug: "salsa-timba",
        courseTitle: "Pending Alpha",
        sessionId: "session-1",
        packagePurchaseId: "purchase-1",
        packageLabel: "Starter",
      },
      {
        id: "pending-2",
        status: "booked",
        startsAt: "2026-10-17T00:00:00.000Z",
        courseSlug: "bachata",
        courseTitle: "Pending Bravo",
        sessionId: "session-2",
        packagePurchaseId: "purchase-1",
        packageLabel: "Starter",
      },
    ]

    const html = renderToStaticMarkup(<AssignClassesCard {...props} />)

    expect(html).toContain("Change Alpha pending")
    expect(html).toContain("Change Bravo pending")
    expect(html).toContain('aria-label="View scheduled classes for day 16"')
    expect(html).toContain("Pending Alpha")
    expect(html).toContain("Pending Bravo")
    expect(html).not.toContain("You do not have scheduled classes")
  })

  it("renders queued slots as New York wall-clock times independently of the host timezone", () => {
    const originalTimeZone = process.env.TZ
    process.env.TZ = "UTC"
    try {
      const props = buildProps()
      props.assignSlots = [{ date: "2026-10-16", time: "19:00" }]

      const html = renderToStaticMarkup(<AssignClassesCard {...props} />)

      expect(html).toContain("7:00 PM")
      expect(html).not.toContain("3:00 PM")
    } finally {
      process.env.TZ = originalTimeZone
    }
  })
})
