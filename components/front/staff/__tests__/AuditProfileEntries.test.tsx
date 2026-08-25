// @vitest-environment jsdom

import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import AuditHistoryPopover from "../AuditHistoryPopover"
import AuditTimeline from "../AuditTimeline"

const profileEntry = {
  id: "audit_profile_1",
  staffClerkId: "staff_1",
  staffName: "Ana Desk",
  entity: "profile" as const,
  entityId: null,
  field: "created",
  valueBefore: null,
  valueAfter: "created",
  reason: "Student created by staff",
  createdAt: "2026-06-28T12:00:00.000Z",
}

describe("audit profile entries", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.restoreAllMocks()
  })

  it("renders profile entries in the audit timeline", async () => {
    await act(async () => {
      root.render(<AuditTimeline studentId="user_1" studentName="Maria Student" initialEntries={[profileEntry]} />)
    })

    expect(container.textContent).toContain("profile")
    expect(container.textContent).toContain("Created")
  })

  it("renders profile entries in the audit history popover", async () => {
    const anchor = document.createElement("button")
    document.body.appendChild(anchor)
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      x: 50,
      y: 50,
      top: 50,
      left: 50,
      right: 70,
      bottom: 70,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { entries: [profileEntry] } }),
    }))

    await act(async () => {
      root.render(
        <AuditHistoryPopover
          studentId="user_1"
          studentName="Maria Student"
          anchorEl={anchor}
          isOpen
          onClose={vi.fn()}
        />
      )
    })

    await act(async () => undefined)

    expect(container.textContent).toContain("profile")
    expect(container.textContent).toContain("Created")

    anchor.remove()
  })
})
