// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useKioskQrCheckoutPoller } from "@/components/front/checkin/hooks/useKioskQrCheckoutPoller"
import { createEmptyKioskQrCheckoutState, type KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useKioskQrCheckoutPoller>[0]

const statusResponse = (ok: boolean, data: Record<string, unknown>) => ({ res: { ok } as Response, data })
const checkoutState = (override: Partial<KioskQrCheckoutState> = {}): KioskQrCheckoutState => ({
  ...createEmptyKioskQrCheckoutState(),
  phase: "qr_ready",
  sessionId: "session-1",
  url: "https://pay.test/checkout",
  ...override,
})
const applyFirstUpdate = (setCheckoutState: ReturnType<typeof vi.fn>, state = checkoutState()) => {
  const update = setCheckoutState.mock.calls[0][0] as (prev: KioskQrCheckoutState) => KioskQrCheckoutState
  return update(state)
}

describe("useKioskQrCheckoutPoller", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let capturedState: KioskQrCheckoutState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    capturedState = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mount = async (params: HookParams) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      useKioskQrCheckoutPoller(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
  }

  const mountStateful = async ({ checkoutState: initialState, ...params }: HookParams) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      const [state, setState] = React.useState(initialState)
      capturedState = state
      useKioskQrCheckoutPoller({ ...params, checkoutState: state, setCheckoutState: setState })
      return null
    }
    await act(async () => root!.render(<Harness />))
  }

  it("does not poll without a session id", async () => {
    vi.useFakeTimers()
    const fetchStatus = vi.fn()
    await mount({ checkoutState: checkoutState({ sessionId: null }), setCheckoutState: vi.fn(), onComplete: vi.fn(), fetchStatus })
    await act(async () => vi.runAllTimersAsync())
    expect(fetchStatus).not.toHaveBeenCalled()
  })

  it("updates waiting state and polls again while payment is pending", async () => {
    vi.useFakeTimers()
    const setCheckoutState = vi.fn()
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(true, { status: "open", awaitingWebhook: true, purchaseId: "p1", paymentStatus: "processing" }))
      .mockResolvedValueOnce(statusResponse(true, { status: "complete" }))
    await mount({ checkoutState: checkoutState(), setCheckoutState, onComplete: vi.fn(), fetchStatus, pollIntervalMs: 25 })
    await act(async () => vi.advanceTimersByTimeAsync(25))
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    expect(applyFirstUpdate(setCheckoutState)).toMatchObject({ phase: "waiting_for_payment", awaitingWebhook: true, purchaseId: "p1", paymentStatus: "processing", error: null })
  })

  it("marks complete and calls onComplete after the completion delay", async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const fetchStatus = vi.fn().mockResolvedValue(statusResponse(true, { status: "complete", purchaseId: "p2", paymentStatus: "paid" }))
    await mountStateful({ checkoutState: checkoutState(), setCheckoutState: vi.fn(), onComplete, fetchStatus, completionDelayMs: 80 })
    await act(async () => Promise.resolve())
    expect(capturedState).toMatchObject({ phase: "complete", purchaseId: "p2", paymentStatus: "paid" })
    await act(async () => vi.advanceTimersByTimeAsync(79))
    expect(onComplete).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("sets expired state when the hosted session expires", async () => {
    vi.useFakeTimers()
    const setCheckoutState = vi.fn()
    await mount({ checkoutState: checkoutState(), setCheckoutState, onComplete: vi.fn(), fetchStatus: vi.fn().mockResolvedValue(statusResponse(true, { status: "expired", error: "Session expired." })) })
    await act(async () => vi.runAllTimersAsync())
    expect(applyFirstUpdate(setCheckoutState)).toMatchObject({ phase: "expired", awaitingWebhook: false, error: "Session expired." })
  })

  it("cancels delayed completion callback after unmount", async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    await mountStateful({ checkoutState: checkoutState(), setCheckoutState: vi.fn(), onComplete, fetchStatus: vi.fn().mockResolvedValue(statusResponse(true, { status: "complete" })), completionDelayMs: 80 })
    await act(async () => {
      await Promise.resolve()
      root?.unmount()
      root = null
      await vi.advanceTimersByTimeAsync(80)
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("sets endpoint error messages", async () => {
    vi.useFakeTimers()
    const setCheckoutState = vi.fn()
    await mount({ checkoutState: checkoutState(), setCheckoutState, onComplete: vi.fn(), fetchStatus: vi.fn().mockResolvedValue(statusResponse(false, { status: "open", error: "Gateway unavailable." })) })
    await act(async () => vi.runAllTimersAsync())
    expect(applyFirstUpdate(setCheckoutState)).toMatchObject({ phase: "error", awaitingWebhook: false, error: "Gateway unavailable." })
  })

  it("sets refresh error state when polling throws", async () => {
    vi.useFakeTimers()
    const setCheckoutState = vi.fn()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    await mount({ checkoutState: checkoutState(), setCheckoutState, onComplete: vi.fn(), fetchStatus: vi.fn().mockRejectedValue(new Error("network down")) })
    await act(async () => vi.runAllTimersAsync())
    expect(applyFirstUpdate(setCheckoutState)).toMatchObject({ phase: "error", awaitingWebhook: false, error: "Unable to refresh checkout status." })
    expect(warnSpy).toHaveBeenCalledWith("Unable to poll consecutive checkout session status", expect.any(Error))
  })
})
