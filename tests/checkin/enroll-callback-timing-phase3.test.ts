import { describe, expect, it, vi } from "vitest"
import {
  createKioskSessionCheckoutPayloadFields,
  forwardKioskSessionCreated,
  handleEmbeddedSignInSessionCreated,
  handleExistingUserDetected,
  notifyPaymentsStepReadyForOpenSession,
  resolveKioskSessionToken,
  resolveStationTimeoutAction,
  shouldHandleExistingUserDetected,
  shouldNotifyPaymentsStepReady,
} from "@/lib/checkin/enroll-flow"

describe("phase 3.1 callback timing contracts", () => {
  it("fires payments-step ready exactly once per open session", () => {
    const onPaymentsStepReadyAction = vi.fn()
    let hasFired = false
    const markFired = () => {
      hasFired = true
    }

    expect(
      notifyPaymentsStepReadyForOpenSession({
        open: true,
        hasFired,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
        markFired,
        onPaymentsStepReadyAction,
      })
    ).toBe(true)
    expect(onPaymentsStepReadyAction).toHaveBeenCalledTimes(1)

    expect(
      notifyPaymentsStepReadyForOpenSession({
        open: true,
        hasFired,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
        markFired,
        onPaymentsStepReadyAction,
      })
    ).toBe(false)
    expect(onPaymentsStepReadyAction).toHaveBeenCalledTimes(1)

    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: false,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
      })
    ).toBe(true)

    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: true,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
      })
    ).toBe(false)
  })

  it("resets payments-step ready after close and waits for the kiosk transition to clear", () => {
    const onPaymentsStepReadyAction = vi.fn()
    let hasFired = true
    const markFired = () => {
      hasFired = true
    }

    // Mirrors the EnrollModal close branch that resets paymentsReadyFiredRef.
    hasFired = false

    expect(
      notifyPaymentsStepReadyForOpenSession({
        open: true,
        hasFired,
        activeStepKey: "payments",
        showKioskPaymentTransition: true,
        markFired,
        onPaymentsStepReadyAction,
      })
    ).toBe(false)
    expect(onPaymentsStepReadyAction).not.toHaveBeenCalled()

    expect(
      notifyPaymentsStepReadyForOpenSession({
        open: true,
        hasFired,
        activeStepKey: "payments",
        showKioskPaymentTransition: false,
        markFired,
        onPaymentsStepReadyAction,
      })
    ).toBe(true)
    expect(onPaymentsStepReadyAction).toHaveBeenCalledTimes(1)
  })

  it("blocks payments-step ready while kiosk payment transition is still visible", () => {
    expect(
      shouldNotifyPaymentsStepReady({
        open: true,
        hasFired: false,
        activeStepKey: "payments",
        showKioskPaymentTransition: true,
      })
    ).toBe(false)
  })

  it("routes inactivity timeout to onTimeoutAction before onCompletedAction", () => {
    const onTimeoutAction = vi.fn()
    const onCompletedAction = vi.fn()

    expect(resolveStationTimeoutAction(onTimeoutAction, onCompletedAction)).toBe(onTimeoutAction)
    expect(resolveStationTimeoutAction(undefined, onCompletedAction)).toBe(onCompletedAction)
  })

  it("detects existing user before continuing kiosk new-student flow", () => {
    const onExistingUserDetected = vi.fn()

    expect(
      handleExistingUserDetected({
        isKioskTerminalFlow: true,
        service: "new-student",
        verifyResult: "existing_detected",
        onExistingUserDetected,
      })
    ).toBe(true)
    expect(onExistingUserDetected).toHaveBeenCalledTimes(1)

    expect(
      handleExistingUserDetected({
        isKioskTerminalFlow: true,
        service: "new-student",
        verifyResult: "sms_pending",
        onExistingUserDetected,
      })
    ).toBe(false)
    expect(onExistingUserDetected).toHaveBeenCalledTimes(1)

    expect(
      shouldHandleExistingUserDetected({
        isKioskTerminalFlow: true,
        service: "new-student",
        verifyResult: "existing_detected",
      })
    ).toBe(true)

    expect(
      shouldHandleExistingUserDetected({
        isKioskTerminalFlow: true,
        service: "new-student",
        verifyResult: "sms_pending",
      })
    ).toBe(false)
  })

  it("forwards kiosk session id immediately when EmbeddedSignIn creates a session", () => {
    const onKioskSessionCreated = vi.fn()

    forwardKioskSessionCreated(onKioskSessionCreated, "sess_123")
    handleEmbeddedSignInSessionCreated({ onKioskSessionCreated, sessionId: "sess_456" })

    expect(onKioskSessionCreated).toHaveBeenCalledTimes(2)
    expect(onKioskSessionCreated).toHaveBeenNthCalledWith(1, "sess_123")
    expect(onKioskSessionCreated).toHaveBeenNthCalledWith(2, "sess_456")
  })

  it("keeps kioskSessionToken payload optional and stable", () => {
    expect(resolveKioskSessionToken("kiosk_session_1")).toBe("kiosk_session_1")
    expect(resolveKioskSessionToken("")).toBeUndefined()
    expect(resolveKioskSessionToken(undefined)).toBeUndefined()
    expect(createKioskSessionCheckoutPayloadFields("kiosk_session_1")).toEqual({ kioskSessionToken: "kiosk_session_1" })
    expect(createKioskSessionCheckoutPayloadFields("")).toEqual({})
    expect(createKioskSessionCheckoutPayloadFields(undefined)).toEqual({})
  })
})
