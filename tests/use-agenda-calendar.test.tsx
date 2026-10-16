import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { useAgendaCalendar } from "@/components/front/profile/hooks/useAgendaCalendar"
import type { BookingItem } from "@/components/front/profile/profile-types"

const originalTimeZone = process.env.TZ

function AgendaProbe({ bookings }: { bookings: BookingItem[] }) {
  const agenda = useAgendaCalendar({
    visibleBookings: bookings,
    pendingBookings: [],
    classRequestsByAttendance: new Map(),
    activityStats: {
      classesTaken: 0,
      weeklyAverage: 0,
      streakWeeks: 0,
      recurringLabel: null,
      lastClassLabel: "Tuesday at 7:00 PM",
    },
  })
  const events = Array.from(agenda.bookingEventsByDay.entries())
  return <output>{JSON.stringify({ events, nextBookedClass: agenda.nextBookedClass })}</output>
}

describe("useAgendaCalendar", () => {
  beforeEach(() => {
    process.env.TZ = "UTC"
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"))
  })

  afterEach(() => {
    process.env.TZ = originalTimeZone
    vi.useRealTimers()
  })

  it("groups booking instants by their New York calendar date", () => {
    const html = renderToStaticMarkup(
      <AgendaProbe
        bookings={[
          {
            id: "attendance-1",
            status: "booked",
            courseTitle: "Salsa Timba",
            startsAt: "2026-11-01T01:00:00.000Z",
          } as BookingItem,
        ]}
      />
    )

    expect(html).toContain("[[31,")
    expect(html).toContain("9:00 PM")
    expect(html).toContain("Salsa Timba")
  })

  it("does not invent a next class for an empty booking list", () => {
    const html = renderToStaticMarkup(<AgendaProbe bookings={[]} />)

    expect(html).toContain("No upcoming class")
    expect(html).not.toContain("Tuesday at 7:00 PM")
  })
})
