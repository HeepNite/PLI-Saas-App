// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffTeamCalendarPanel from "@/components/front/staff/StaffTeamCalendarPanel"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffTeamCalendarPanelProps = React.ComponentProps<typeof StaffTeamCalendarPanel>

const createProps = (overrides: Partial<StaffTeamCalendarPanelProps> = {}): StaffTeamCalendarPanelProps => ({
  showStaffOps: true,
  scheduleMonthLabel: "May 2026",
  scheduleLoading: false,
  calendarCells: [
    { dateKey: "2026-05-01", day: 1, inMonth: true },
    { dateKey: "2026-05-02", day: 2, inMonth: true },
  ],
  scheduleEventsByDay: {
    "2026-05-01": [
      {
        attendanceId: "att-1",
        status: "checked_in",
        startsAtIso: "2026-05-01T10:00:00.000Z",
        timeLabel: "10:00 AM",
        courseSlug: "bachata",
        courseTitle: "Bachata Basics",
        userId: "user-1",
        userName: "Jane Doe",
        userEmail: "jane@example.com",
        userPhone: "555",
      },
    ],
  },
  onPreviousMonth: vi.fn(),
  onNextMonth: vi.fn(),
  ...overrides,
})

describe("StaffTeamCalendarPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: StaffTeamCalendarPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffTeamCalendarPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Team calendar")
  })

  it("renders calendar events and navigation controls", async () => {
    const previous = vi.fn()
    const next = vi.fn()
    const node = await renderPanel(createProps({ onPreviousMonth: previous, onNextMonth: next }))

    expect(node.textContent).toContain("Team calendar")
    expect(node.textContent).toContain("May 2026")
    expect(node.textContent).toContain("10:00 AM")
    expect(node.textContent).toContain("Jane Doe")
    const buttons = Array.from(node.querySelectorAll("button"))
    await act(async () => {
      buttons[0].click()
      buttons[1].click()
    })
    expect(previous).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
