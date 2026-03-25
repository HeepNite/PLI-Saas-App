import { describe, expect, it } from "vitest"
import {
  createEmptyKioskQrCheckoutState,
  getKioskPaymentTransitionMessage,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  KIOSK_PAYMENT_TRANSITION_MIN_MS,
  resolveKioskQrPhaseFromStatus,
  shouldShowKioskPaymentTransition,
  shouldAutoAdvanceKioskInfoStep,
  shouldMaskKioskInfoStep,
  shouldPauseKioskInactivityForQrPhase,
} from "@/lib/checkin/kiosk-qr-payment"

describe("kiosk QR payment helpers", () => {
  it("enables the early info skip for kiosk existing customers with valid prefill", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(true)
  })

  it("accepts normalized or UI-formatted phone values for the kiosk fast path", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "9293876584",
        },
      })
    ).toBe(true)

    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 (929) 387-6584",
        },
      })
    ).toBe(true)
  })

  it("keeps the early info skip off when kiosk existing-customer context is incomplete", () => {
    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)

    expect(
      isKioskInfoFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: false,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)
  })

  it("enables the auto-submit fast path only for kiosk existing-customer card checkouts with valid prefill", () => {
    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "stripe",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(true)
  })

  it("only auto-advances the info step while the kiosk fast path is idle", () => {
    expect(
      shouldAutoAdvanceKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
        activeStepKey: "info",
        open: true,
        processing: false,
        identityCheckBusy: false,
        requiresSignIn: false,
        hasError: false,
      })
    ).toBe(true)

    expect(
      shouldAutoAdvanceKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
        activeStepKey: "info",
        open: true,
        processing: false,
        identityCheckBusy: true,
        requiresSignIn: false,
        hasError: false,
      })
    ).toBe(false)
  })

  it("masks the kiosk info step while terminal prefill is hydrating or auto-skipping", () => {
    expect(
      shouldMaskKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "info",
        open: true,
        requiresSignIn: false,
        hasError: false,
        hydrating: true,
        fastPathEligible: false,
      })
    ).toBe(true)

    expect(
      shouldMaskKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "info",
        open: true,
        requiresSignIn: false,
        hasError: false,
        hydrating: false,
        fastPathEligible: true,
      })
    ).toBe(true)

    expect(
      shouldMaskKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "info",
        open: true,
        requiresSignIn: false,
        hasError: false,
        hydrating: false,
        fastPathEligible: false,
      })
    ).toBe(false)
  })

  it("shows the branded payment transition only when kiosk existing customers enter payments", () => {
    expect(
      shouldShowKioskPaymentTransition({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "payments",
        previousStepKey: "info",
      })
    ).toBe(true)

    expect(
      shouldShowKioskPaymentTransition({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "payments",
        previousStepKey: "payments",
      })
    ).toBe(false)

    expect(
      shouldShowKioskPaymentTransition({
        isKioskTerminalFlow: false,
        isCheckInExistingFlow: true,
        activeStepKey: "payments",
        previousStepKey: "info",
      })
    ).toBe(false)
  })

  it("builds the branded payment transition copy with or without first name", () => {
    expect(getKioskPaymentTransitionMessage("Mora")).toBe("We're getting your payment ready, Mora.")
    expect(getKioskPaymentTransitionMessage("   ")).toBe("We're getting your payment ready.")
    expect(KIOSK_PAYMENT_TRANSITION_MIN_MS).toBeGreaterThanOrEqual(800)
  })

  it("keeps the auto-submit fast path off for cash or incomplete prefill", () => {
    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "onsite",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "Diaz",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)

    expect(
      isKioskCardFastPathEligible({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        paymentMethod: "stripe",
        date: "2026-03-24",
        time: "18:30",
        contact: {
          firstName: "Mora",
          lastName: "",
          email: "mora@example.com",
          phone: "+1 929 387 6584",
        },
      })
    ).toBe(false)
  })

  it("pauses kiosk inactivity only while the QR is active or waiting", () => {
    expect(shouldPauseKioskInactivityForQrPhase("qr_ready")).toBe(true)
    expect(shouldPauseKioskInactivityForQrPhase("waiting_for_payment")).toBe(true)
    expect(shouldPauseKioskInactivityForQrPhase("creating")).toBe(false)
    expect(shouldPauseKioskInactivityForQrPhase("expired")).toBe(false)
  })

  it("maps durable polling statuses to kiosk QR phases", () => {
    expect(resolveKioskQrPhaseFromStatus("open")).toBe("waiting_for_payment")
    expect(resolveKioskQrPhaseFromStatus("complete")).toBe("complete")
    expect(resolveKioskQrPhaseFromStatus("expired")).toBe("expired")
    expect(resolveKioskQrPhaseFromStatus("not_found")).toBe("expired")
  })

  it("creates an empty checkout state", () => {
    expect(createEmptyKioskQrCheckoutState()).toEqual({
      phase: "idle",
      sessionId: null,
      url: null,
      expiresAt: null,
      awaitingWebhook: false,
      purchaseId: null,
      paymentStatus: null,
      error: null,
    })
  })
})
