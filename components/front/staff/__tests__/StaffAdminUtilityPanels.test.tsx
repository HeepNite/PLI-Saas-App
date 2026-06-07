// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAdminUtilityPanels from "@/components/front/staff/StaffAdminUtilityPanels"

vi.mock("@/components/front/staff/StaffTerminalSetupClient", () => ({
  default: () => <div data-testid="terminal-setup">Terminal setup client</div>,
}))

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAdminUtilityPanels>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  terminal: { isVisible: false, canManageSetup: false },
  assistant: {
    isVisible: false,
    config: { tone: "concise", searchMode: "hybrid", workflow: "operations", includeSources: true, suggestActions: false, requireConfirmation: true },
    setConfig: vi.fn(),
    message: null,
    onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
  },
  settings: { isVisible: false },
  ...overrides,
})

describe("StaffAdminUtilityPanels", () => {
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
    await act(async () => root!.render(<StaffAdminUtilityPanels {...props} />))
    return container
  }

  it("renders terminal setup for managers and fallback links for limited users", async () => {
    const setupNode = await renderPanel(createProps({ terminal: { isVisible: true, canManageSetup: true } }))
    expect(setupNode.textContent).toContain("Terminal setup client")

    await act(async () => root?.unmount())
    root = null
    setupNode.remove()

    const fallbackNode = await renderPanel(createProps({ terminal: { isVisible: true, canManageSetup: false } }))
    expect(fallbackNode.textContent).toContain("Reception terminal")
    expect(fallbackNode.querySelector<HTMLAnchorElement>('a[href="/staff/terminal"]')?.textContent).toBe("Open terminal")
  })

  it("renders assistant config and wires submit/change callbacks", async () => {
    const setConfig = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())
    const node = await renderPanel(createProps({ assistant: { ...createProps().assistant, isVisible: true, setConfig, onSubmit, message: "Saved" } }))
    const toneSelect = node.querySelector<HTMLSelectElement>("select")
    const form = node.querySelector<HTMLFormElement>("form")

    await act(async () => {
      toneSelect!.value = "balanced"
      toneSelect!.dispatchEvent(new Event("change", { bubbles: true }))
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(node.textContent).toContain("Agent configuration")
    expect(node.textContent).toContain("Saved")
    expect(setConfig).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("renders settings panel", async () => {
    const node = await renderPanel(createProps({ settings: { isVisible: true } }))

    expect(node.textContent).toContain("Portal configuration")
    expect(node.textContent).toContain("Security defaults")
  })
})
