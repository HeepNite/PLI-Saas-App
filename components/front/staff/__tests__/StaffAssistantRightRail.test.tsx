// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAssistantRightRail from "@/components/front/staff/StaffAssistantRightRail"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAssistantRightRail>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  showRightRail: true,
  showInlineRightRail: true,
  isRailCollapsed: false,
  rightRailRef: { current: null },
  onCloseOverlay: vi.fn(),
  onToggleRail: vi.fn(),
  children: <div>Assistant content</div>,
  ...overrides,
})

describe("StaffAssistantRightRail", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  const renderRail = async (props: Props) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffAssistantRightRail {...props} />))
    return container
  }

  it("keeps the floating assistant trigger available on desktop when collapsed", async () => {
    const node = await renderRail(createProps({ isRailCollapsed: true, showInlineRightRail: false }))
    const trigger = node.querySelector("[data-assistant-rail-trigger]")

    expect(trigger?.className).toContain("min-[1180px]:pointer-events-auto")
    expect(trigger?.className).toContain("min-[1180px]:opacity-100")
    expect(trigger?.className).not.toContain("min-[1180px]:hidden")
  })
})
