// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffAssistantRailContent from "@/components/front/staff/StaffAssistantRailContent"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffAssistantRailContent>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  isRailCollapsed: false,
  activeNavLabel: "Students",
  chatMessages: [
    { id: "assistant-welcome", role: "assistant", text: "Welcome" },
    { id: "user-1", role: "user", text: "Show students" },
  ],
  chatInput: "next step",
  onToggleRail: vi.fn(),
  onOpenAssistantConfig: vi.fn(),
  onChatInputChange: vi.fn(),
  onSendChatMessage: vi.fn((event: React.FormEvent) => event.preventDefault()),
  ...overrides,
})

describe("StaffAssistantRailContent", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderContent(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffAssistantRailContent {...props} />))
    return container
  }

  it("renders chat messages and section-specific input placeholder", async () => {
    const node = await renderContent(createProps())

    expect(node.textContent).toContain("Admin copilot")
    expect(node.textContent).toContain("Welcome")
    expect(node.textContent).toContain("Show students")
    expect(node.querySelector("input")?.getAttribute("placeholder")).toBe("Message about students...")
  })

  it("wires toggle, config, input, and submit callbacks", async () => {
    const props = createProps()
    const node = await renderContent(props)
    const input = node.querySelector("input") as HTMLInputElement
    const form = node.querySelector("form") as HTMLFormElement

    await act(async () => {
      node.querySelector('[aria-label="Hide AI assistant"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      node.querySelector('[aria-label="Open assistant configuration"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "check reports")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(props.onToggleRail).toHaveBeenCalledTimes(1)
    expect(props.onOpenAssistantConfig).toHaveBeenCalledTimes(1)
    expect(props.onChatInputChange).toHaveBeenCalledWith("check reports")
    expect(props.onSendChatMessage).toHaveBeenCalledTimes(1)
  })
})
