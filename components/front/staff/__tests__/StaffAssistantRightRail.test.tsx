// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAssistantRightRail from "@/components/front/staff/StaffAssistantRightRail"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAssistantRightRail>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  showRightRail: true,
  showInlineRightRail: true,
  isRailCollapsed: false,
  rightRailRef: { current: null },
  onCloseOverlay: vi.fn(),
  onToggleRail: vi.fn(),
  children: <div data-testid="assistant-content">Assistant content</div>,
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

  async function renderRail(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffAssistantRightRail {...props} />))
    return container
  }

  it("keeps the desktop rail sticky without desktop wrapper padding", async () => {
    const node = await renderRail(createProps())
    const rail = node.querySelector("aside")
    const panel = node.querySelector("aside > div")

    expect(rail?.className).toContain("min-[1180px]:sticky")
    expect(rail?.className).toContain("min-[1180px]:top-3")
    expect(rail?.className).toContain("px-0")
    expect(rail?.className).not.toContain("px-3")
    expect(rail?.className).not.toContain("sm:px-4")
    expect(rail?.className).not.toContain("md:px-6")
    expect(panel?.className).toContain("min-[1180px]:p-3")
    expect(panel?.className).not.toContain("min-[1180px]:sticky")
  })

  it("uses transform and opacity for compact rail animation", async () => {
    const node = await renderRail(createProps({ showInlineRightRail: false, isRailCollapsed: true }))
    const rail = node.querySelector("aside")

    expect(rail?.className).toContain("transform-gpu")
    expect(rail?.className).toContain("transition-[transform,opacity]")
    expect(rail?.className).toContain("duration-700")
    expect(rail?.className).toContain("ease-[cubic-bezier(0.16,1,0.3,1)]")
    expect(rail?.className).toContain("translate-y-6")
    expect(rail?.className).toContain("scale-[0.98]")
    expect(rail?.className).toContain("opacity-0")
  })

  it("hides the floating assistant reopen button while the rail is open", async () => {
    const node = await renderRail(createProps({ showInlineRightRail: true, isRailCollapsed: false }))

    expect(node.querySelector("[data-assistant-rail-trigger]")).toBeNull()
  })

  it("shows the floating assistant reopen button when the rail is closed", async () => {
    const node = await renderRail(createProps({ showInlineRightRail: false, isRailCollapsed: true }))
    const reopenButton = node.querySelector<HTMLButtonElement>("[data-assistant-rail-trigger]")

    expect(reopenButton).not.toBeNull()
    expect(reopenButton?.getAttribute("aria-label")).toBe("Show AI assistant")
    expect(reopenButton?.className).not.toContain("min-[1180px]:hidden")
  })

  it("reopens the assistant with the existing rail toggle handler", async () => {
    const onToggleRail = vi.fn()
    const node = await renderRail(createProps({ showInlineRightRail: false, isRailCollapsed: true, onToggleRail }))
    const reopenButton = node.querySelector<HTMLButtonElement>("[data-assistant-rail-trigger]")

    await act(async () => {
      reopenButton!.click()
    })

    expect(onToggleRail).toHaveBeenCalledTimes(1)
  })
})
