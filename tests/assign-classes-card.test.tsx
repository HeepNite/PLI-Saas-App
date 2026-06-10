import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AssignClassesCard } from "@/components/front/profile/sections/AssignClassesCard"
import type { CourseData } from "@/constants/courses"

describe("AssignClassesCard", () => {
  it("renders package info, slot section and queued classes summary", () => {
    const html = renderToStaticMarkup(
      <AssignClassesCard
        assignPackageId="pkg-1"
        setAssignPackageId={vi.fn()}
        assignablePackages={[
          {
            id: "pkg-1",
            packageId: "starter",
            label: "Starter",
            courseSlug: "salsa-1",
            remainingCredits: 3,
            totalCredits: 5,
            isUnlimited: false,
            expiresAt: null,
          },
        ]}
        todayNyDateKey="2026-10-01"
        assignDate="2026-10-12"
        setAssignDate={vi.fn()}
        assignTime="09:00"
        setAssignTime={vi.fn()}
        assignAvailability={[
          { time: "09:00", label: "9:00 AM", spotsLeft: 2, capacity: 8, isFull: false, isPast: false },
        ]}
        assignAvailabilityLoading={false}
        assignSlots={[{ date: "2026-10-12", time: "09:00" }]}
        assigning={false}
        assignError={null}
        setAssignError={vi.fn()}
        assignSuccess={null}
        setAssignSuccess={vi.fn()}
        selectedPackageForAssign={{
          id: "pkg-1",
          packageId: "starter",
          label: "Starter",
          courseSlug: "salsa-1",
          remainingCredits: 3,
          totalCredits: 5,
          isUnlimited: false,
          expiresAt: null,
        }}
        selectedPackageCourse={{
          slug: "salsa-1",
          title: "Salsa 1",
          schedule: { day: "Monday", time: "9:00", availableWeekdays: [1] },
        } as CourseData}
        selectedPackageAssignmentStats={{ assigned: 2, remaining: 1, queued: 1, isUnlimited: false }}
        assignUnavailableDates={[]}
        assignBookedTimesForSelectedDate={new Set<string>()}
        addAssignSlot={vi.fn()}
        removeAssignSlot={vi.fn()}
        submitAssignClasses={vi.fn()}
        agendaState={{
          mobileAgendaOpenDay: null,
          setMobileAgendaOpenDay: vi.fn(),
          agendaMonth: 0,
          setAgendaMonth: vi.fn(),
          agendaYear: 2026,
          setAgendaYear: vi.fn(),
          calendarDays: [],
          agendaMonthLabel: "January",
          agendaYears: [2025, 2026, 2027],
          bookingEventsByDay: new Map(),
          pendingBookingEventsByDay: new Map(),
          nextBookedClass: { scheduleLabel: "No upcoming class", courseTitle: "" },
        }}
        pendingBookings={[]}
        visibleBookings={[]}
        classRequestsByAttendance={new Map()}
      />
    )

    expect(html).toContain("Assign classes")
    expect(html).toContain("Starter")
    expect(html).toContain("Classes to confirm")
    expect(html).toContain("Assign classes")
    expect(html).toContain("You earn 2.5 points for assigning this package for the first time.")
  })
})
