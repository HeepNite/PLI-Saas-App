// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useKioskQrPoller } from "@/components/front/courses/enroll/hooks/useKioskQrPoller"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/components/front/courses/enroll/effects/kiosk-qr-poller", () => ({
  createKioskQrPoller: vi.fn(),
}))

import { createKioskQrPoller } from "@/components/front/courses/enroll/effects/kiosk-qr-poller"

const mockCreateKioskQrPoller = vi.mocked(createKioskQrPoller)

type HookProps = Parameters<typeof useKioskQrPoller>[0]
type PollerOptions = Parameters<typeof createKioskQrPoller>[0]

function defaultProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    open: true,
    isKioskTerminalFlow: true,
    sessionId: "session-abc",
    kioskQrCheckoutPending: true,
    completeDropInCheckInAfterCardPayment: vi.fn().mockResolvedValue(null),
    setSuccessMessage: vi.fn(),
    setSuccess: vi.fn(),
    setRequiresSignIn: vi.fn(),
    setExistingAccountDetected: vi.fn(),
    setResumeAfterSignInStep: vi.fn(),
    setPendingAutoPay: vi.fn(),
    setKioskQrCheckout: vi.fn(),
    ...overrides,
  }
}

describe("useKioskQrPoller", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    mockCreateKioskQrPoller.mockReturnValue(() => {})
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  async function mount(props: HookProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      useKioskQrPoller(props)
      return null
    }
    await act(async () => root!.render(React.createElement(Harness)))
  }

  it("starts the poller when all conditions are met", async () => {
    await mount(defaultProps())
    expect(mockCreateKioskQrPoller).toHaveBeenCalledTimes(1)
    expect(mockCreateKioskQrPoller).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-abc" })
    )
  })

  it("does not start the poller when open is false", async () => {
    await mount(defaultProps({ open: false }))
    expect(mockCreateKioskQrPoller).not.toHaveBeenCalled()
  })

  it("does not start the poller when isKioskTerminalFlow is false", async () => {
    await mount(defaultProps({ isKioskTerminalFlow: false }))
    expect(mockCreateKioskQrPoller).not.toHaveBeenCalled()
  })

  it("does not start the poller when sessionId is null", async () => {
    await mount(defaultProps({ sessionId: null }))
    expect(mockCreateKioskQrPoller).not.toHaveBeenCalled()
  })

  it("does not start the poller when kioskQrCheckoutPending is false", async () => {
    await mount(defaultProps({ kioskQrCheckoutPending: false }))
    expect(mockCreateKioskQrPoller).not.toHaveBeenCalled()
  })

  it("calls the cleanup function returned by createKioskQrPoller on unmount", async () => {
    const cleanup = vi.fn()
    mockCreateKioskQrPoller.mockReturnValue(cleanup)

    await mount(defaultProps())
    expect(cleanup).not.toHaveBeenCalled()

    await act(async () => root?.unmount())
    root = null

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("dispatches complete state correctly via onOutcome", async () => {
    let capturedOptions: PollerOptions | null = null
    mockCreateKioskQrPoller.mockImplementation((options) => {
      capturedOptions = options
      return () => {}
    })

    const setSuccess = vi.fn()
    const setSuccessMessage = vi.fn()
    const setRequiresSignIn = vi.fn()
    const setExistingAccountDetected = vi.fn()
    const setResumeAfterSignInStep = vi.fn()
    const setPendingAutoPay = vi.fn()
    const setKioskQrCheckout = vi.fn()
    const completeDropInCheckInAfterCardPayment = vi.fn().mockResolvedValue("Great, you're in!")

    await mount(
      defaultProps({
        setSuccess,
        setSuccessMessage,
        setRequiresSignIn,
        setExistingAccountDetected,
        setResumeAfterSignInStep,
        setPendingAutoPay,
        setKioskQrCheckout,
        completeDropInCheckInAfterCardPayment,
      })
    )

    await act(async () => {
      await capturedOptions!.onOutcome({ type: "complete", purchaseId: "p1", paymentStatus: "paid" })
    })

    expect(completeDropInCheckInAfterCardPayment).toHaveBeenCalledWith({ purchaseId: "p1" })
    expect(setSuccessMessage).toHaveBeenCalledWith("Great, you're in!")
    expect(setSuccess).toHaveBeenCalledWith(true)
    expect(setRequiresSignIn).toHaveBeenCalledWith(false)
    expect(setExistingAccountDetected).toHaveBeenCalledWith(false)
    expect(setResumeAfterSignInStep).toHaveBeenCalledWith(null)
    expect(setPendingAutoPay).toHaveBeenCalledWith(false)
    expect(setKioskQrCheckout).toHaveBeenCalledWith(createEmptyKioskQrCheckoutState())
  })

  it("dispatches error state correctly via onOutcome", async () => {
    let capturedOptions: PollerOptions | null = null
    mockCreateKioskQrPoller.mockImplementation((options) => {
      capturedOptions = options
      return () => {}
    })

    const setKioskQrCheckout = vi.fn()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await mount(defaultProps({ setKioskQrCheckout }))

    const error = new Error("network fail")
    await act(async () => {
      await capturedOptions!.onOutcome({ type: "error", error, message: "Unable to refresh checkout status." })
    })

    expect(warnSpy).toHaveBeenCalledWith("Unable to poll hosted checkout session status", error)
    expect(setKioskQrCheckout).toHaveBeenCalledTimes(1)
    const updater = setKioskQrCheckout.mock.calls[0][0] as (
      prev: ReturnType<typeof createEmptyKioskQrCheckoutState>
    ) => ReturnType<typeof createEmptyKioskQrCheckoutState>
    const result = updater(createEmptyKioskQrCheckoutState())
    expect(result).toMatchObject({ phase: "error", awaitingWebhook: false, error: "Unable to refresh checkout status." })
  })

  it("dispatches state patch via onOutcome for non-complete non-error outcomes", async () => {
    let capturedOptions: PollerOptions | null = null
    mockCreateKioskQrPoller.mockImplementation((options) => {
      capturedOptions = options
      return () => {}
    })

    const setKioskQrCheckout = vi.fn()
    await mount(defaultProps({ setKioskQrCheckout }))

    const statePatch = { phase: "waiting_for_payment" as const, awaitingWebhook: true, error: null }
    await act(async () => {
      await capturedOptions!.onOutcome({ type: "state", state: statePatch })
    })

    expect(setKioskQrCheckout).toHaveBeenCalledTimes(1)
    const updater = setKioskQrCheckout.mock.calls[0][0] as (
      prev: ReturnType<typeof createEmptyKioskQrCheckoutState>
    ) => ReturnType<typeof createEmptyKioskQrCheckoutState>
    const result = updater(createEmptyKioskQrCheckoutState())
    expect(result).toMatchObject({ phase: "waiting_for_payment", awaitingWebhook: true, error: null })
  })
})
