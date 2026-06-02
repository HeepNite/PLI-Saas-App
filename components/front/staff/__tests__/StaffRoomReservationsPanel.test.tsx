// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffRoomReservationsPanel from "@/components/front/staff/StaffRoomReservationsPanel"

vi.mock("@/components/front/ui/CalendarPicker", () => ({
  default: ({ onRangeChange }: { onRangeChange: (start: string, end?: string) => void }) => (
    <button type="button" onClick={() => onRangeChange("2026-06-01", "2026-06-02")}>
      Pick range
    </button>
  ),
}))

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffRoomReservationsPanel>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  wizard: { step: 1, totalSteps: 3, onPrevious: vi.fn(), onNext: vi.fn() },
  form: {
    roomReservationForm: {
      roomId: "room-1",
      title: "Private lesson",
      reason: "VIP booking",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      startTime: "10:00",
      endTime: "11:00",
      assignedStaffClerkUserId: "staff-1",
    },
    reservationRangePreview: "Jun 1, 10:00 AM → Jun 2, 11:00 AM",
    roomReservationFormError: null,
    roomReservationFormSuccess: null,
    roomReservationSaving: false,
    activeRoomOptions: [{ id: "room-1", name: "Studio A" }],
    reservationAssignableStaff: [{ id: "staff-1", label: "Ada Teacher" }],
    onDateRangeChange: vi.fn(),
    onFieldChange: vi.fn(),
    onSubmit: vi.fn((event: React.FormEvent) => event.preventDefault()),
    formatReservationDateLabel: (value) => value,
  },
  list: {
    schoolLoading: false,
    reservations: [
      {
        id: "res-1",
        roomId: "room-1",
        title: "Private lesson",
        reason: "VIP booking",
        category: null,
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T11:00:00.000Z",
        status: "active",
        assignedStaffClerkUserId: "staff-1",
        cancellationReason: null,
      },
    ],
    roomById: { "room-1": { id: "room-1", name: "Studio A", capacity: 12, location: "North", active: true } },
    roomReservationBusyId: null,
    onCancel: vi.fn(),
    formatDateTime: (value) => String(value),
    resolveAssignedStaffLabel: (staffId) => (staffId === "staff-1" ? "Ada Teacher" : "Unassigned"),
  },
  ...overrides,
})

describe("StaffRoomReservationsPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffRoomReservationsPanel {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderPanel(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("renders reservation form and current reservations", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Private reservations")
    expect(node.textContent).toContain("Current and upcoming room reservations")
    expect(node.textContent).toContain("Private lesson")
    expect(node.textContent).toContain("Studio A")
    expect(node.textContent).toContain("Assigned: Ada Teacher")
  })

  it("wires range, submit, cancel, and wizard callbacks", async () => {
    const props = createProps()
    const node = await renderPanel(props)
    const form = node.querySelector("form")
    const cancelButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Cancel")
    const previousButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "← Previous")
    const nextButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Next →")

    await act(async () => {
      node.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      cancelButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      previousButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      nextButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.form.onDateRangeChange).toHaveBeenCalledWith("2026-06-01", "2026-06-02")
    expect(props.form.onSubmit).toHaveBeenCalledTimes(1)
    expect(props.list.onCancel).toHaveBeenCalledWith(props.list.reservations[0])
    expect(props.wizard.onPrevious).toHaveBeenCalledTimes(1)
    expect(props.wizard.onNext).toHaveBeenCalledTimes(1)
  })
})
