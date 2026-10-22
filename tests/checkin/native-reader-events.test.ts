// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getNativeCollectionPrompt,
  getNativeReaderStatus,
  nativeCardAvailability,
  parseNativeEvent,
  pollPreparedPurchaseState,
  subscribeNativeReaderEvents,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"

type Listener = (event: { data: unknown }) => void
type Bridge = {
  postMessage: (message: string) => void
  onmessage?: Listener | null
  addEventListener?: (type: string, listener: Listener) => void
  removeEventListener?: (type: string, listener: Listener) => void
  emit: (data: unknown) => void
}

function installBridge(postMessage: (message: string) => void = () => {}, withEventListener = true) {
  const listeners = new Set<Listener>()
  const bridge: Bridge = {
    postMessage,
    emit: (data) => {
      const event = { data: typeof data === "string" ? data : JSON.stringify(data) }
      bridge.onmessage?.(event)
      listeners.forEach((listener) => listener(event))
    },
  }
  if (withEventListener) {
    bridge.addEventListener = (type, listener) => { if (type === "message") listeners.add(listener) }
    bridge.removeEventListener = (type, listener) => { if (type === "message") listeners.delete(listener) }
  }
  ;(window as unknown as { pliNativeBridge?: Bridge }).pliNativeBridge = bridge
  return bridge
}

const status = (value: string) => ({ version: 1, event: "readerStatus", payload: { status: value } })
const prompt = (value: string) => ({ version: 1, event: "collectionPrompt", payload: { prompt: value } })

afterEach(() => {
  delete (window as unknown as { pliNativeBridge?: Bridge }).pliNativeBridge
})

describe("native reader events", () => {
  it("accepts only the two closed event shapes", () => {
    expect(parseNativeEvent(status("connected"))).toEqual({ kind: "readerStatus", status: "connected" })
    expect(parseNativeEvent(prompt("awaiting_card"))).toEqual({ kind: "collectionPrompt", prompt: "awaiting_card" })
    expect(parseNativeEvent({ ...status("connected"), requestId: "r" })).toBeNull()
    expect(parseNativeEvent({ version: 1, event: "readerStatus", payload: { status: "connected", serial: "WSC" } })).toBeNull()
    expect(parseNativeEvent(status("charging"))).toBeNull()
    expect(parseNativeEvent(prompt("insert_card"))).toBeNull()
    expect(parseNativeEvent({ version: 2, event: "readerStatus", payload: { status: "connected" } })).toBeNull()
    expect(parseNativeEvent({ version: 1, event: "other", payload: {} })).toBeNull()
  })

  it("reports unknown without a bridge and never subscribes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNativeReaderEvents(listener)

    expect(getNativeReaderStatus()).toBe("unknown")
    expect(getNativeCollectionPrompt()).toBe("none")
    unsubscribe()
  })

  it("requests the current status once and follows pushed status and prompts", () => {
    const postMessage = vi.fn()
    const bridge = installBridge(postMessage)
    const listener = vi.fn()

    const unsubscribe = subscribeNativeReaderEvents(listener)
    subscribeNativeReaderEvents(vi.fn())()

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ version: 1, operation: "getReaderStatus", requestId: expect.any(String), payload: {} })
    expect(getNativeReaderStatus()).toBe("unknown")

    bridge.emit(status("connecting"))
    expect(getNativeReaderStatus()).toBe("connecting")
    bridge.emit(status("connected"))
    bridge.emit(prompt("awaiting_card"))
    expect(getNativeReaderStatus()).toBe("connected")
    expect(getNativeCollectionPrompt()).toBe("awaiting_card")
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    bridge.emit(prompt("processing"))
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it("ignores unknown, malformed, and request-reply messages", () => {
    const bridge = installBridge()
    const listener = vi.fn()
    subscribeNativeReaderEvents(listener)
    bridge.emit(status("connected"))

    bridge.emit("not json")
    bridge.emit({ version: 1, event: "readerStatus", payload: { status: "connected", id: "tmr_x" } })
    bridge.emit({ version: 1, operation: "getReaderStatus", requestId: "r", payload: { operationReference: "x", state: "accepted" } })

    expect(getNativeReaderStatus()).toBe("connected")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("a replacement bridge starts from unknown again", () => {
    installBridge().emit(status("connected"))
    subscribeNativeReaderEvents(vi.fn())
    const replacement = installBridge()

    subscribeNativeReaderEvents(vi.fn())

    expect(getNativeReaderStatus()).toBe("unknown")
    replacement.emit(status("disconnected"))
    expect(getNativeReaderStatus()).toBe("disconnected")
  })

  it("an event pushed during a payment poll never turns the poll uncertain", async () => {
    const bridge = installBridge((raw) => {
      const request = JSON.parse(raw)
      if (request.operation !== "getPreparedPurchaseState") return
      bridge.emit(prompt("awaiting_card"))
      bridge.emit({ version: 1, operation: "getPreparedPurchaseState", requestId: request.requestId, payload: { operationReference: "op_1", state: "pending" } })
    })

    await expect(pollPreparedPurchaseState("op_1", 50)).resolves.toBe("pending")
  })

  it("gates the card option only on an explicit not-ready status", () => {
    expect(nativeCardAvailability("connected")).toEqual({ available: true, reason: null })
    expect(nativeCardAvailability("unknown")).toEqual({ available: true, reason: null })
    expect(nativeCardAvailability("connecting")).toEqual({ available: false, reason: "Card reader is connecting…" })
    expect(nativeCardAvailability("disconnected")).toEqual({
      available: false,
      reason: "Card reader unavailable — please pay with cash or another method",
    })
  })
})
