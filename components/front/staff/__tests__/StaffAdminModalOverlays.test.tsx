// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAdminModalOverlays from "@/components/front/staff/StaffAdminModalOverlays"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAdminModalOverlays>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  roomSafeDeleteModal: null,
  roomReassignModal: null,
  roomReservationCancelModal: null,
  delayModal: null,
  studentPinModal: null,
  activeRoomOptions: [
    { id: "room-1", name: "Studio A", capacity: 12, location: "North", active: true },
    { id: "room-2", name: "Studio B", capacity: 10, location: "South", active: true },
  ],
  roomBusyId: null,
  roomReservationBusyId: null,
  studentPinReason: "Front desk recovery",
  studentPinDraft: "12ab34",
  studentPinSubmitting: false,
  studentPinError: null,
  studentPinIssued: null,
  studentPinRevealIssued: false,
  onCloseRoomSafeDelete: vi.fn(),
  onUpdateRoomSafeDeleteReason: vi.fn(),
  onConfirmRoomSafeDelete: vi.fn(),
  onCloseRoomReassign: vi.fn(),
  onUpdateRoomReassignTarget: vi.fn(),
  onUpdateRoomReassignMoveFutureSessions: vi.fn(),
  onUpdateRoomReassignCourseSelection: vi.fn(),
  onConfirmRoomReassign: vi.fn(),
  onCloseRoomReservationCancel: vi.fn(),
  onUpdateRoomReservationCancelReason: vi.fn(),
  onConfirmRoomReservationCancel: vi.fn(),
  onCloseDelayDetails: vi.fn(),
  onCloseStudentPin: vi.fn(),
  onStudentPinReasonChange: vi.fn(),
  onStudentPinDraftChange: vi.fn(),
  onToggleStudentPinReveal: vi.fn(),
  onCopyStudentPinError: vi.fn(),
  onSubmitStudentPinIssue: vi.fn(),
  formatMinutesLabel: (minutes) => `${minutes} minutes`,
  formatIsoDate: (value) => value || "Not set",
  ...overrides,
})

describe("StaffAdminModalOverlays", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderOverlays(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffAdminModalOverlays {...props} />))
    return container
  }

  it("renders nothing when all modal states are closed", async () => {
    const node = await renderOverlays(createProps())

    expect(node.textContent).toBe("")
  })

  it("wires room safe delete reason, close, and confirm actions", async () => {
    const props = createProps({
      roomSafeDeleteModal: {
        room: { id: "room-1", name: "Studio A", capacity: 12, location: null, active: true },
        reason: "",
        error: "Reason required",
      },
    })
    const node = await renderOverlays(props)

    await act(async () => {
      node.querySelector("textarea")!.dispatchEvent(new Event("change", { bubbles: true }))
      ;(node.querySelector("textarea") as HTMLTextAreaElement).value = "Permanent closure"
      node.querySelector("textarea")!.dispatchEvent(new Event("input", { bubbles: true }))
      node.querySelector('[aria-label="Close room safe-delete dialog"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Room safe delete")
    expect(node.textContent).toContain("Reason required")
    expect(props.onCloseRoomSafeDelete).toHaveBeenCalledTimes(1)
  })

  it("wires room reassignment target, course selection, and confirm actions", async () => {
    const props = createProps({
      roomReassignModal: {
        room: { id: "room-1", name: "Studio A", capacity: 12, location: null, active: true },
        targetRoomId: "room-2",
        moveFutureSessions: false,
        availableCourses: [{ id: "course-1", title: "Mat Pilates", slug: "mat", scheduleLabel: "Mon 10:00 AM" }],
        selectedCourseIds: ["course-1"],
        error: null,
      },
    })
    const node = await renderOverlays(props)
    const select = node.querySelector("select") as HTMLSelectElement
    const checkboxes = node.querySelectorAll('input[type="checkbox"]')

    await act(async () => {
      select.value = "room-2"
      select.dispatchEvent(new Event("change", { bubbles: true }))
      checkboxes[0].dispatchEvent(new MouseEvent("click", { bubbles: true }))
      checkboxes[1].dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Confirm reassignment")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Room reassignment")
    expect(props.onUpdateRoomReassignTarget).toHaveBeenCalledWith("room-2")
    expect(props.onUpdateRoomReassignMoveFutureSessions).toHaveBeenCalledWith(true)
    expect(props.onUpdateRoomReassignCourseSelection).toHaveBeenCalledWith("course-1", false)
    expect(props.onConfirmRoomReassign).toHaveBeenCalledTimes(1)
  })

  it("renders delay details and student PIN copy controls", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const props = createProps({
      delayModal: {
        row: { id: "staff-1", name: "Ada Teacher" },
        entries: [{ id: "entry-1", dateLabel: "May 29", expectedTime: "10:00", actualTime: "10:05", delayMinutes: 5 }],
        totalDelayMinutes: 5,
        lateDays: 1,
      } as unknown as Props["delayModal"],
      studentPinModal: {
        userId: "user-1",
        name: "Student One",
        email: "student@example.com",
        needsEnrollment: false,
        provisionalActive: true,
        provisionalExpiresAt: "2026-05-29T23:59:00.000Z",
      },
      studentPinIssued: { value: "1234", masked: "••34", expiresAt: "2026-05-29T23:59:00.000Z" },
    })
    const node = await renderOverlays(props)

    await act(async () => {
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Reveal")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Copy PIN")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Delay details")
    expect(node.textContent).toContain("+5m")
    expect(node.textContent).toContain("Student PIN")
    expect(props.onToggleStudentPinReveal).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith("1234")
    expect(props.onCopyStudentPinError).toHaveBeenCalledWith("Unable to copy provisional PIN.")
  })
})
