import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { RescheduleModal } from "@/components/front/profile/modals/RescheduleModal"

describe("RescheduleModal", () => {
  const booking = { id: "booking-1", status: "BOOKED", startsAt: "2026-10-12T09:00:00.000Z", courseSlug: "salsa-1", courseTitle: "Salsa 1", sessionId: "session-1", packagePurchaseId: null, packageLabel: "Starter" }

  it("renders nothing when hidden", () => {
    const html = renderToStaticMarkup(
      <RescheduleModal
        isOpen={false}
        selectedBooking={booking}
        closeChangeClassModal={vi.fn()}
        rescheduleStepItems={[{ id: 1, label: "Reassignment" }, { id: 2, label: "Confirmation" }, { id: 3, label: "Assign pending" }]}
        rescheduleStep={1}
        setRescheduleStep={vi.fn()}
        rescheduleCourseSlug=""
        setRescheduleCourseSlug={vi.fn()}
        visibleBookings={[booking]}
        setSelectedBookingId={vi.fn()}
        hydrateRescheduleFromBooking={vi.fn()}
        rescheduleCourseOptions={[{ slug: "salsa-1", title: "Salsa 1" }]}
        rescheduleScopedBookings={[booking]}
        rescheduleDate=""
        setRescheduleDate={vi.fn()}
        setRescheduleTime={vi.fn()}
        setRescheduleError={vi.fn()}
        nyTimezone="America/New_York"
        todayNyDateKey="2026-10-10"
        selectedBookingCourseAvailableWeekdays={[1]}
        isRescheduleDateBlocked={() => false}
        getRescheduleDateBlockReason={() => undefined}
        availabilityLoading={false}
        availability={[]}
        rescheduleBookedTimesForSelectedDate={new Set<string>()}
        isCurrentRescheduleSlot={() => false}
        rescheduleTime=""
        continueRescheduleStep={vi.fn()}
        submitPrimaryReschedule={vi.fn()}
        rescheduleSaving={false}
        pendingAssignablePackages={[]}
        sourceCourses={[{ slug: "salsa-1", title: "Salsa 1" }]}
        rescheduleError={null}
        rescheduleSuccess={null}
      />
    )

    expect(html).toBe("")
  })

  it("renders visible state with expected copy", () => {
    const html = renderToStaticMarkup(
      <RescheduleModal
        isOpen
        selectedBooking={booking}
        closeChangeClassModal={vi.fn()}
        rescheduleStepItems={[{ id: 1, label: "Reassignment" }, { id: 2, label: "Confirmation" }, { id: 3, label: "Assign pending" }]}
        rescheduleStep={1}
        setRescheduleStep={vi.fn()}
        rescheduleCourseSlug=""
        setRescheduleCourseSlug={vi.fn()}
        visibleBookings={[booking]}
        setSelectedBookingId={vi.fn()}
        hydrateRescheduleFromBooking={vi.fn()}
        rescheduleCourseOptions={[{ slug: "salsa-1", title: "Salsa 1" }]}
        rescheduleScopedBookings={[booking]}
        rescheduleDate="2026-10-12"
        setRescheduleDate={vi.fn()}
        setRescheduleTime={vi.fn()}
        setRescheduleError={vi.fn()}
        nyTimezone="America/New_York"
        todayNyDateKey="2026-10-10"
        selectedBookingCourseAvailableWeekdays={[1]}
        isRescheduleDateBlocked={() => false}
        getRescheduleDateBlockReason={() => undefined}
        availabilityLoading={false}
        availability={[{ time: "09:00", label: "9:00 AM", spotsLeft: 2, capacity: 8, isFull: false, isPast: false }]}
        rescheduleBookedTimesForSelectedDate={new Set<string>()}
        isCurrentRescheduleSlot={() => false}
        rescheduleTime="09:00"
        continueRescheduleStep={vi.fn()}
        submitPrimaryReschedule={vi.fn()}
        rescheduleSaving={false}
        pendingAssignablePackages={[]}
        sourceCourses={[{ slug: "salsa-1", title: "Salsa 1" }]}
        rescheduleError={null}
        rescheduleSuccess={null}
      />
    )

    expect(html).toContain("Step-by-step reschedule")
    expect(html).toContain("Selected course")
    expect(html).toContain("Continue")
  })

  it("wires close callback", () => {
    const closeChangeClassModal = vi.fn()
    const element = RescheduleModal({
      isOpen: true,
      selectedBooking: booking,
      closeChangeClassModal,
      rescheduleStepItems: [{ id: 1, label: "Reassignment" }, { id: 2, label: "Confirmation" }, { id: 3, label: "Assign pending" }],
      rescheduleStep: 1,
      setRescheduleStep: vi.fn(),
      rescheduleCourseSlug: "",
      setRescheduleCourseSlug: vi.fn(),
      visibleBookings: [booking],
      setSelectedBookingId: vi.fn(),
      hydrateRescheduleFromBooking: vi.fn(),
      rescheduleCourseOptions: [{ slug: "salsa-1", title: "Salsa 1" }],
      rescheduleScopedBookings: [booking],
      rescheduleDate: "2026-10-12",
      setRescheduleDate: vi.fn(),
      setRescheduleTime: vi.fn(),
      setRescheduleError: vi.fn(),
      nyTimezone: "America/New_York",
      todayNyDateKey: "2026-10-10",
      selectedBookingCourseAvailableWeekdays: [1],
      isRescheduleDateBlocked: () => false,
      getRescheduleDateBlockReason: () => undefined,
      availabilityLoading: false,
      availability: [],
      rescheduleBookedTimesForSelectedDate: new Set<string>(),
      isCurrentRescheduleSlot: () => false,
      rescheduleTime: "",
      continueRescheduleStep: vi.fn(),
      submitPrimaryReschedule: vi.fn(),
      rescheduleSaving: false,
      pendingAssignablePackages: [],
      sourceCourses: [{ slug: "salsa-1", title: "Salsa 1" }],
      rescheduleError: null,
      rescheduleSuccess: null,
    })

    type WalkNode = {
      type?: unknown
      props?: { onClick?: () => void; children?: unknown; "aria-label"?: string }
    }
    const stack: WalkNode[] = [element as WalkNode]
    while (stack.length) {
      const node = stack.pop()
      if (!node?.props) continue
      if (node.type === "button" && node.props.onClick && node.props["aria-label"] === "Close") {
        node.props.onClick()
        break
      }
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children]
      for (const child of children) stack.push(child as WalkNode)
    }

    expect(closeChangeClassModal).toHaveBeenCalledTimes(1)
  })
})
