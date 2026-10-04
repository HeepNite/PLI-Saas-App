// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handOffPreparedPurchase,
  isNativePaymentBridgeAvailable,
  parsePreparedPurchaseResponse,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"

type Bridge = { postMessage: (message: string) => void; onmessage?: ((event: { data: unknown }) => void) | null }
const reference = "A".repeat(43)

function installBridge(postMessage: Bridge["postMessage"]) {
  const bridge: Bridge = { postMessage }
  ;(window as unknown as { pliNativeBridge?: Bridge }).pliNativeBridge = bridge
  return bridge
}

afterEach(() => {
  delete (window as unknown as { pliNativeBridge?: Bridge }).pliNativeBridge
  vi.useRealTimers()
})

describe("native payment bridge", () => {
  it("recognizes only the AndroidX-style postMessage object", () => {
    expect(isNativePaymentBridgeAvailable()).toBe(false)
    ;(window as unknown as { pliNativeBridge?: unknown }).pliNativeBridge = {}
    expect(isNativePaymentBridgeAvailable()).toBe(false)
    installBridge(vi.fn())
    expect(isNativePaymentBridgeAvailable()).toBe(true)
  })

  it("sends the closed v1 envelope and admits a valid coarse response", async () => {
    const postMessage = vi.fn((raw: string) => {
      const request = JSON.parse(raw)
      bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
    })
    const bridge = installBridge(postMessage)

    await expect(handOffPreparedPurchase(reference, 10)).resolves.toEqual({ admitted: true, state: "accepted" })
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      version: 1,
      operation: "startPreparedPurchase",
      requestId: expect.any(String),
      payload: { preparedPurchaseReference: reference },
    })
  })

  it.each([
    ["malformed", (bridge: Bridge) => bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", payload: {} }) })],
    ["rejected", (bridge: Bridge) => bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: "request", payload: { operationReference: "op_1", state: "rejected" } }) })],
  ])("treats post-dispatch %s responses as admitted", async (_name, reply) => {
    let bridge: Bridge
    bridge = installBridge(() => reply(bridge))
    await expect(handOffPreparedPurchase(reference, 10)).resolves.toMatchObject({ admitted: true })
  })

  it("treats a post-dispatch exception and timeout as admitted uncertainty", async () => {
    installBridge(() => { throw new Error("ambiguous") })
    await expect(handOffPreparedPurchase(reference, 10)).resolves.toEqual({ admitted: true, state: "uncertain" })

    vi.useFakeTimers()
    installBridge(() => {})
    const pending = handOffPreparedPurchase(reference, 10)
    await vi.advanceTimersByTimeAsync(10)
    await expect(pending).resolves.toEqual({ admitted: true, state: "uncertain" })
  })

  it("rejects extra, secret-bearing, or non-closed native responses", () => {
    expect(parsePreparedPurchaseResponse({ version: 1, operation: "startPreparedPurchase", requestId: "r", payload: { operationReference: "op_1", state: "accepted" } }, "r")).toEqual({ state: "accepted" })
    expect(parsePreparedPurchaseResponse({ version: 1, operation: "startPreparedPurchase", requestId: "r", payload: { operationReference: "op_1", state: "accepted", clientSecret: "secret" } }, "r")).toBeNull()
    expect(parsePreparedPurchaseResponse({ version: 1, operation: "startPreparedPurchase", requestId: "r", payload: { operationReference: "op_1", state: "paid" } }, "r")).toBeNull()
  })
})
