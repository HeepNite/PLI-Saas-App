// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useStaffAssistantAdmin } from "@/components/front/staff/useStaffAssistantAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffAssistantAdmin>

function HookHarness({ activeNavLabel, onState }: { activeNavLabel: string; onState: (state: HookState) => void }) {
  const state = useStaffAssistantAdmin(activeNavLabel)
  onState(state)
  return <div>{state.chatMessages.map((message) => message.text).join("|")}</div>
}

describe("useStaffAssistantAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function renderHookHarness(activeNavLabel = "Students") {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness activeNavLabel={activeNavLabel} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("initializes assistant config, welcome message, and expanded desktop rail", async () => {
    const state = await renderHookHarness()

    expect(state.config.tone).toBe("balanced")
    expect(state.chatMessages[0]?.id).toBe("assistant-welcome")
    expect(state.isRailCollapsed).toBe(false)
  })

  it("sends chat messages using the active nav label and clears input", async () => {
    const state = await renderHookHarness("Reports")

    await act(async () => {
      state.setChatInput("summarize today")
    })
    await act(async () => {
      latestState!.sendChatMessage({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(latestState!.chatInput).toBe("")
    expect(latestState!.chatMessages.at(-2)?.text).toBe("summarize today")
    expect(latestState!.chatMessages.at(-1)?.text).toContain("Estoy en Reports")
  })

  it("saves config message and clears it after the timeout", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.saveConfig({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })
    expect(latestState!.configMessage).toBe("Assistant settings updated.")

    await act(async () => {
      vi.advanceTimersByTime(2200)
    })

    expect(latestState!.configMessage).toBeNull()
  })
})
