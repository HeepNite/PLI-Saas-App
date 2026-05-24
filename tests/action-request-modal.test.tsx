import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ActionRequestModal } from "@/components/front/profile/modals/ActionRequestModal"

describe("ActionRequestModal", () => {
  const booking = { id: "booking-1", status: "BOOKED", startsAt: "2026-10-12T09:00:00.000Z", courseSlug: "salsa-1", courseTitle: "Salsa 1", sessionId: "session-1", packagePurchaseId: null, packageLabel: null }

  it("renders nothing when request type is null", () => {
    const html = renderToStaticMarkup(
      <ActionRequestModal
        requestModalType={null}
        closeRequestModal={vi.fn()}
        requestSuspendPackageId=""
        setRequestSuspendPackageId={vi.fn()}
        suspendablePackages={[]}
        requestSuspendStart=""
        setRequestSuspendStart={vi.fn()}
        requestSuspendEnd=""
        setRequestSuspendEnd={vi.fn()}
        requestCancelBookingId=""
        setRequestCancelBookingId={vi.fn()}
        setRequestCancelDecision={vi.fn()}
        setRequestSubmitError={vi.fn()}
        visibleBookings={[booking]}
        formatDateTimeInTimeZone={(value) => String(value)}
        requestCancelBooking={null}
        requestCancelDecision={null}
        requestMessage=""
        setRequestMessage={vi.fn()}
        requestSubmitError={null}
        submitActionRequest={vi.fn()}
        requestSubmitting={false}
      />
    )

    expect(html).toBe("")
  })

  it("renders cancel branch copy", () => {
    const html = renderToStaticMarkup(
      <ActionRequestModal
        requestModalType="CANCEL"
        closeRequestModal={vi.fn()}
        requestSuspendPackageId=""
        setRequestSuspendPackageId={vi.fn()}
        suspendablePackages={[]}
        requestSuspendStart=""
        setRequestSuspendStart={vi.fn()}
        requestSuspendEnd=""
        setRequestSuspendEnd={vi.fn()}
        requestCancelBookingId=""
        setRequestCancelBookingId={vi.fn()}
        setRequestCancelDecision={vi.fn()}
        setRequestSubmitError={vi.fn()}
        visibleBookings={[booking]}
        formatDateTimeInTimeZone={(value) => String(value)}
        requestCancelBooking={null}
        requestCancelDecision={null}
        requestMessage=""
        setRequestMessage={vi.fn()}
        requestSubmitError={null}
        submitActionRequest={vi.fn()}
        requestSubmitting={false}
      />
    )

    expect(html).toContain("Cancel class")
    expect(html).toContain("Do you want to reassign this class?")
    expect(html).toContain("Continue")
  })

  it("wires continue action callback", () => {
    const submitActionRequest = vi.fn()
    const element = ActionRequestModal({
      requestModalType: "SUSPEND",
      closeRequestModal: vi.fn(),
      requestSuspendPackageId: "",
      setRequestSuspendPackageId: vi.fn(),
      suspendablePackages: [],
      requestSuspendStart: "",
      setRequestSuspendStart: vi.fn(),
      requestSuspendEnd: "",
      setRequestSuspendEnd: vi.fn(),
      requestCancelBookingId: "",
      setRequestCancelBookingId: vi.fn(),
      setRequestCancelDecision: vi.fn(),
      setRequestSubmitError: vi.fn(),
      visibleBookings: [booking],
      formatDateTimeInTimeZone: (value) => String(value),
      requestCancelBooking: null,
      requestCancelDecision: null,
      requestMessage: "",
      setRequestMessage: vi.fn(),
      requestSubmitError: null,
      submitActionRequest,
      requestSubmitting: false,
    })

    const stack = [element as any]
    while (stack.length) {
      const node = stack.pop()
      if (!node?.props) continue
      if (node.type === "button" && node.props.onClick && String(node.props.children).includes("Continue")) {
        node.props.onClick()
        break
      }
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children]
      for (const child of children) stack.push(child)
    }

    expect(submitActionRequest).toHaveBeenCalledTimes(1)
  })
})
