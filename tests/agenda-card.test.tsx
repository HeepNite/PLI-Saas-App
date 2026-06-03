import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AgendaCard } from "@/components/front/profile/sections/AgendaCard"

describe("AgendaCard", () => {
  it("renders calendar controls and pending process labels", () => {
    const html = renderToStaticMarkup(
      <AgendaCard
        mobileAgendaOpenDay={null}
        setMobileAgendaOpenDay={vi.fn()}
        agendaMonth={9}
        setAgendaMonth={vi.fn()}
        agendaYear={2026}
        setAgendaYear={vi.fn()}
        calendarDays={[
          { day: 0, isCurrent: false },
          { day: 12, isCurrent: true },
        ]}
        agendaMonthLabel="October"
        agendaYears={[2025, 2026, 2027]}
        bookingEventsByDay={
          new Map([
            [12, [{ id: "b1", time: "09:00", courseTitle: "Salsa 1", startsAt: "2026-10-12T09:00:00.000Z", processType: null, processLabel: null }]],
          ])
        }
        pendingBookingEventsByDay={
          new Map([
            [12, [{ id: "b1", time: "09:00", courseTitle: "Salsa 1", startsAt: "2026-10-12T09:00:00.000Z", packageId: null, packageLabel: null, courseSlug: "salsa-1", processLabel: "Cancel request in progress", processType: "CANCEL" }]],
          ])
        }
        nextBookedClass={{ scheduleLabel: "Mon, Oct 12 · 9:00 AM", courseTitle: "Salsa 1" }}
        pendingBookings={[
          { id: "b1", status: "BOOKED", startsAt: "2026-10-12T09:00:00.000Z", courseSlug: "salsa-1", courseTitle: "Salsa 1", sessionId: "s1", packagePurchaseId: null, packageLabel: null },
        ]}
        visibleBookings={[
          { id: "b1", status: "BOOKED", startsAt: "2026-10-12T09:00:00.000Z", courseSlug: "salsa-1", courseTitle: "Salsa 1", sessionId: "s1", packagePurchaseId: null, packageLabel: null },
        ]}
        classRequestsByAttendance={
          new Map([
            ["b1", { id: "r1", type: "CANCEL", status: "PENDING", createdAt: "2026-10-10T08:00:00.000Z", message: null, meta: null, resolvedAt: null }],
          ])
        }
      />
    )

    expect(html).toContain("Agenda")
    expect(html).toContain("Previous month")
    expect(html).toContain("Next month")
    expect(html).toContain("Cancel request in progress")
    expect(html).toContain("Processes for assigned classes")
  })
})
