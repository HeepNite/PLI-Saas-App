import { describe, expect, it } from "vitest"
import {
  createEmptyKioskQrCheckoutState,
  getKioskPaymentTransitionMessage,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  KIOSK_PAYMENT_TRANSITION_MIN_MS,
  resolveKioskQrPhaseFromStatus,
  shouldAutoAdvanceKioskInfoStep,
  shouldMaskKioskInfoStep,
  shouldPauseKioskInactivityForQrPhase,
  shouldShowKioskResolvingOverlay,
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

  it("masks the kiosk info step only while terminal prefill is hydrating or transitioning", () => {
    expect(
      shouldMaskKioskInfoStep({
        isKioskTerminalFlow: true,
        isCheckInExistingFlow: true,
        activeStepKey: "info",
        open: true,
        requiresSignIn: false,
        hasError: false,
        hydrating: true,
        transitionPending: false,
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
        transitionPending: true,
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
        transitionPending: false,
      })
    ).toBe(false)
  })

  it("builds the payment transition copy with or without first name", () => {
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

  describe("shouldShowKioskResolvingOverlay", () => {
    const base = {
      isKioskTerminalFlow: true,
      mode: "existing" as const,
      isSignedIn: true,
      loadingBootstrap: false,
      hasBootstrap: false,
      hasExistingRegularBookingOverride: false,
      hasVisibleError: false,
    }

    it("shows the overlay while bootstrap is loading", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, loadingBootstrap: true })).toBe(true)
    })

    it("shows the overlay when bootstrap resolved but EnrollModal not open yet", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: false,
          hasExistingRegularBookingOverride: false,
          hasVisibleError: false,
        })
      ).toBe(true)
    })

    it("hides the overlay once the EnrollModal is open", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasExistingRegularBookingOverride: true,
        })
      ).toBe(false)
    })

    it("hides the overlay when a visible error should be shown instead", () => {
      expect(
        shouldShowKioskResolvingOverlay({ ...base, hasVisibleError: true })
      ).toBe(false)
    })

    it("does not show the overlay for non-kiosk flows", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, isKioskTerminalFlow: false })).toBe(false)
    })

    it("does not show the overlay when the user is not signed in", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, isSignedIn: false })).toBe(false)
    })

    it("does not show the overlay outside the existing-customer mode", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, mode: "idle" })).toBe(false)
      expect(shouldShowKioskResolvingOverlay({ ...base, mode: "new" })).toBe(false)
    })
  })
})
