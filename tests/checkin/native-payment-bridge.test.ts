// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handOffPreparedPurchase,
  installPliNativeBridgeDiagnostic,
  isNativeKioskWebView,
  isNativePaymentBridgeAvailable,
  parsePreparedPurchaseResponse,
  recoverNativeKioskBridge,
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
  delete (window as unknown as { pliNativeBridgeDiagnostic?: unknown }).pliNativeBridgeDiagnostic
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
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

  it("distinguishes the installed Android WebView from an ordinary Android browser", () => {
    expect(isNativeKioskWebView("Mozilla/5.0 (Linux; Android 11; SM-T500) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36")).toBe(false)
    expect(isNativeKioskWebView("Mozilla/5.0 (Linux; Android 11; SM-T500 Build/RP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/131 Mobile Safari/537.36")).toBe(true)
    expect(isNativeKioskWebView("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(false)
  })

  it("reloads a missing native WebView bridge once, then fails closed until a bridge succeeds", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-T500; wv) Version/4.0 Chrome/131" })
    const reload = vi.fn()

    expect(recoverNativeKioskBridge(reload)).toBe("reloading")
    expect(recoverNativeKioskBridge(reload)).toBe("unavailable")
    expect(reload).toHaveBeenCalledTimes(1)

    installBridge(vi.fn())
    expect(recoverNativeKioskBridge(reload)).toBe("ready")
    delete (window as unknown as { pliNativeBridge?: Bridge }).pliNativeBridge
    expect(recoverNativeKioskBridge(reload)).toBe("reloading")
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it("sends the closed v1 envelope and admits a valid coarse response", async () => {
    const postMessage = vi.fn((raw: string) => {
      const request = JSON.parse(raw)
      bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
    })
    const bridge = installBridge(postMessage)

    await expect(handOffPreparedPurchase(reference, 10)).resolves.toEqual({ admitted: true, state: "accepted", operationReference: "op_1" })
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
    const bridge: Bridge = installBridge(() => reply(bridge))
    await expect(handOffPreparedPurchase(reference, 10)).resolves.toMatchObject({ admitted: true })
  })

  it("polls only the exact admitted operation and accepts PAID only from its exact correlated reply", async () => {
    let pollCount = 0
    const postMessage = vi.fn((raw: string) => {
      const request = JSON.parse(raw)
      pollCount += 1
      bridge.onmessage?.({ data: JSON.stringify({
        version: 1,
        operation: "getPreparedPurchaseState",
        requestId: request.requestId,
        payload: { operationReference: pollCount === 1 ? "other_operation" : "op_1", state: "paid" },
      }) })
    })
    const bridge = installBridge(postMessage)
    const poll = (await import("@/components/front/courses/enroll/effects/native-payment-bridge") as unknown as {
      pollPreparedPurchaseState: (operationReference: string, timeoutMs?: number) => Promise<string>
    }).pollPreparedPurchaseState

    await expect(poll("op_1", 10)).resolves.toBe("uncertain")
    await expect(poll("op_1", 10)).resolves.toBe("paid")
    expect(JSON.parse(postMessage.mock.calls[1][0])).toEqual({
      version: 1,
      operation: "getPreparedPurchaseState",
      requestId: expect.any(String),
      payload: { operationReference: "op_1" },
    })
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

  it("exposes a read-only diagnostic that sends and correlates only its closed empty-payload request", async () => {
    installPliNativeBridgeDiagnostic()
    const postMessage = vi.fn((raw: string) => {
      const request = JSON.parse(raw)
      bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "diagnosticRoundTrip", requestId: request.requestId, payload: { operationReference: "diagnostic_1", state: "accepted" } }) })
    })
    const bridge = installBridge(postMessage)
    const diagnostic = (window as unknown as { pliNativeBridgeDiagnostic: () => Promise<{ success: boolean }> }).pliNativeBridgeDiagnostic

    await expect(diagnostic()).resolves.toEqual({ success: true })
    expect(Object.getOwnPropertyDescriptor(window, "pliNativeBridgeDiagnostic")?.writable).toBe(false)
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ version: 1, operation: "diagnosticRoundTrip", requestId: expect.any(String), payload: {} })
  })

  it.each([
    ["mismatched request", (bridge: Bridge) => bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "diagnosticRoundTrip", requestId: "other", payload: { operationReference: "diagnostic_1", state: "accepted" } }) })],
    ["malformed response", (bridge: Bridge) => bridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "diagnosticRoundTrip", requestId: "request", payload: {} }) })],
    ["throw", () => { throw new Error("bridge failure") }],
  ])("returns coarse failure for a diagnostic %s", async (_name, reply) => {
    installPliNativeBridgeDiagnostic()
    const bridge: Bridge = installBridge(() => reply(bridge))

    await expect((window as unknown as { pliNativeBridgeDiagnostic: () => Promise<{ success: boolean }> }).pliNativeBridgeDiagnostic()).resolves.toEqual({ success: false })
  })

  it("returns coarse failure when the diagnostic reply times out", async () => {
    vi.useFakeTimers()
    installPliNativeBridgeDiagnostic()
    installBridge(() => {})
    const pending = (window as unknown as { pliNativeBridgeDiagnostic: () => Promise<{ success: boolean }> }).pliNativeBridgeDiagnostic()

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(pending).resolves.toEqual({ success: false })
  })

  it("does not replace a non-owned diagnostic global", () => {
    delete (window as unknown as { pliNativeBridgeDiagnostic?: unknown }).pliNativeBridgeDiagnostic
    const existing = vi.fn()
    ;(window as unknown as { pliNativeBridgeDiagnostic?: unknown }).pliNativeBridgeDiagnostic = existing

    expect(installPliNativeBridgeDiagnostic()).toBe(false)
    expect((window as unknown as { pliNativeBridgeDiagnostic?: unknown }).pliNativeBridgeDiagnostic).toBe(existing)
  })

  it("does not replace an existing undefined diagnostic property", () => {
    Object.defineProperty(window, "pliNativeBridgeDiagnostic", { value: undefined, configurable: true })

    expect(installPliNativeBridgeDiagnostic()).toBe(false)
    expect(Object.getOwnPropertyDescriptor(window, "pliNativeBridgeDiagnostic")?.value).toBeUndefined()
  })
})
