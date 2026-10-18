// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  useAgendaCalendar,
  type AgendaCalendarState,
} from "@/components/front/profile/hooks/useAgendaCalendar"
import type { BookingItem } from "@/components/front/profile/profile-types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let latest: AgendaCalendarState | null = null

function Harness() {
  latest = useAgendaCalendar({
    visibleBookings: [],
    pendingBookings: [{
      id: "pending-1",
      status: "booked",
      startsAt: "2026-10-16T23:00:00.000Z",
      courseSlug: "salsa-timba",
      courseTitle: "Pending Salsa",
    } as BookingItem],
    classRequestsByAttendance: new Map(),
    activityStats: {
      classesTaken: 0,
      weeklyAverage: 0,
      streakWeeks: 0,
      recurringLabel: null,
      lastClassLabel: null,
    },
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"))
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  latest = null
  vi.useRealTimers()
})

it("keeps a pending-only day open after expansion", async () => {
  await act(async () => root.render(<Harness />))
  expect(latest?.pendingBookingEventsByDay.get(16)).toHaveLength(1)

  await act(async () => latest?.setMobileAgendaOpenDay(16))

  expect(latest?.mobileAgendaOpenDay).toBe(16)
})
