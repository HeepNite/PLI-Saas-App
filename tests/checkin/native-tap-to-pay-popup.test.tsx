// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NativeTapToPayPopup } from "@/components/front/checkin/NativeTapToPayPopup"
import { getNativeCollectionPrompt, subscribeNativeReaderEvents } from "@/components/front/courses/enroll/effects/native-payment-bridge"
import { runNativePreparedCheckout } from "@/components/front/courses/enroll/native-prepared-checkout"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Listener = (event: { data: unknown }) => void
let root: Root | null = null
let container: HTMLDivElement | null = null
let emitPrompt: (prompt: string) => void = () => {}

function installEventBridge(postMessage: (raw: string) => void = vi.fn()) {
  const listeners = new Set<Listener>()
  const bridge = {
    postMessage,
    onmessage: null as Listener | null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }
  ;(window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge = bridge
  emitPrompt = (prompt) => act(() => {
    const data = JSON.stringify({ version: 1, event: "collectionPrompt", payload: { prompt } })
    listeners.forEach((listener) => listener({ data }))
  })
  return bridge
}

async function mount() {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<NativeTapToPayPopup />)
    await Promise.resolve()
  })
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  delete (window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge
})

describe("NativeTapToPayPopup", () => {
  it("stays hidden outside the native kiosk and before the reader asks for a card", async () => {
    await mount()
    expect(container?.querySelector("[role='dialog']")).toBeNull()

    installEventBridge()
    await act(async () => root?.render(<NativeTapToPayPopup />))
    expect(container?.querySelector("[role='dialog']")).toBeNull()
  })

  it("appears exactly on awaiting_card, switches on processing, and closes on the result", async () => {
    installEventBridge()
    await mount()

    emitPrompt("awaiting_card")
    const dialog = container?.querySelector("[role='dialog']")
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute("aria-modal")).toBe("true")
    expect(container?.querySelector("[aria-live]")?.textContent).toContain("Tap your card on the reader")
    expect(container?.querySelector("video")?.getAttribute("src")).toBe("/kiosk/tap-to-pay.mp4")

    emitPrompt("processing")
    expect(container?.querySelector("[aria-live]")?.textContent).toContain("Processing…")
    expect(container?.querySelector("video")).toBeNull()

    emitPrompt("none")
    expect(container?.querySelector("[role='dialog']")).toBeNull()
  })

  it("falls back to the CSS animation when the video cannot load", async () => {
    installEventBridge()
    await mount()
    emitPrompt("awaiting_card")

    await act(async () => {
      container?.querySelector("video")?.dispatchEvent(new Event("error"))
    })

    expect(container?.querySelector("video")).toBeNull()
    expect(container?.querySelector("[data-tap-fallback]")).not.toBeNull()
  })

  it("a finished native checkout clears a prompt the reader never cleared", async () => {
    const bridge = installEventBridge((raw) => {
      const request = JSON.parse(raw)
      if (request.operation !== "startPreparedPurchase") return
      bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "rejected" } }) })
    })
    subscribeNativeReaderEvents(() => {})
    emitPrompt("awaiting_card")
    expect(getNativeCollectionPrompt()).toBe("awaiting_card")

    await runNativePreparedCheckout({
      refreshPreparedContext: async () => true,
      requestPreparedPurchase: async () => ({
        res: { ok: true } as Response,
        data: { preparedPurchaseReference: "A".repeat(43), state: "prepared" },
      }),
    })

    expect(getNativeCollectionPrompt()).toBe("none")
  })
})
