import { describe, expect, it } from "vitest"
import {
  buildSpecialClassReservationQrUrl,
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
  shouldShowPackageCheckInFailureOverlay,
} from "@/lib/checkin/kiosk-qr-payment"

describe("kiosk QR payment helpers", () => {
  it("routes the configured Salsa class through the international reservation flow while preserving generic slugs", () => {
    const salsaUrl = buildSpecialClassReservationQrUrl("special-salsa-class-2026-08-30")
    const genericUrl = buildSpecialClassReservationQrUrl("another-special-class")

    expect(salsaUrl).toBe("/special-salsa-class?reserve=1")
    expect(genericUrl).toBe("/special-classes/another-special-class")
    expect(salsaUrl).not.toContain("/api/checkout/session")
  })

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

  it("does not pause kiosk inactivity while the QR is active or waiting", () => {
    expect(shouldPauseKioskInactivityForQrPhase("qr_ready")).toBe(false)
    expect(shouldPauseKioskInactivityForQrPhase("waiting_for_payment")).toBe(false)
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
      hasActiveCustomerSession: true,
      hasPendingPinRotation: false,
      loadingBootstrap: false,
      hasBootstrap: false,
      hasPackage: false,
      processingPackageCheckIn: false,
      hasPackageCheckInResult: false,
      hasExistingRegularBookingOverride: false,
      hasVisibleError: false,
      hasPackageOffer: false,
      paymentsStepReady: false,
    }

    it("shows the overlay while bootstrap is loading", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, loadingBootstrap: true })).toBe(true)
    })

    it("hides the overlay once bootstrap finished without a resolved payload", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: false,
          hasExistingRegularBookingOverride: false,
          hasVisibleError: false,
        })
      ).toBe(false)
    })

    it("shows the overlay in the post-bootstrap / pre-modal gap (bootstrap arrived but useEffect not flushed yet)", () => {
      // hasBootstrap=true but override not set yet — this was the source of the visual jump
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasExistingRegularBookingOverride: false,
          hasVisibleError: false,
        })
      ).toBe(true)
    })

    it("keeps the overlay up when EnrollModal is open but payments step is not ready yet", () => {
      // Modal is open (override set) but still transitioning to payments internally
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasExistingRegularBookingOverride: true,
          paymentsStepReady: false,
        })
      ).toBe(true)
    })

    it("hides the overlay once the EnrollModal is open AND payments step is ready", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasExistingRegularBookingOverride: true,
          paymentsStepReady: true,
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

    it("does not show the overlay when there is no active customer session", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, hasActiveCustomerSession: false })).toBe(false)
    })

    it("shows the overlay for kiosk PIN sessions even before Clerk sign-in exists", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, hasActiveCustomerSession: true, loadingBootstrap: true })).toBe(true)
    })

    it("hides the overlay while a kiosk PIN rotation step is still pending", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          hasPendingPinRotation: true,
          loadingBootstrap: false,
          hasBootstrap: false,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(false)
    })

    it("hides the overlay when hasPackageOffer is true (package offer screen is visible)", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackageOffer: true,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(false)
    })

    it("shows the overlay when hasPackageOffer is false (normal flow continues)", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: true,
          hasPackageOffer: false,
        })
      ).toBe(true)
    })

    it("hides the overlay when hasPackageOffer is true even if bootstrap is loading", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: true,
          hasPackageOffer: true,
        })
      ).toBe(false)
    })

    it("does not show the overlay outside the existing-customer mode", () => {
      expect(shouldShowKioskResolvingOverlay({ ...base, mode: "idle" })).toBe(false)
      expect(shouldShowKioskResolvingOverlay({ ...base, mode: "new" })).toBe(false)
    })

    it("keeps the overlay while package check-in is processing", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackage: true,
          processingPackageCheckIn: true,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(true)
    })

    it("keeps the overlay during the package auto-check-in render gap", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackage: true,
          processingPackageCheckIn: false,
          hasPackageCheckInResult: false,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(true)
    })

    it("hides the overlay once package check-in completes", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackage: true,
          processingPackageCheckIn: false,
          hasPackageCheckInResult: true,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(false)
    })

    it("hides the overlay once a terminal package check-in failure is recorded (spinner-exit pure gate)", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackage: true,
          processingPackageCheckIn: false,
          hasPackageCheckInResult: false,
          hasExistingRegularBookingOverride: false,
          hasPackageCheckInFailure: true,
        })
      ).toBe(false)
    })

    it("keeps the overlay up during the package auto-check-in gap when hasPackageCheckInFailure is omitted (defaults to false)", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: false,
          hasBootstrap: true,
          hasPackage: true,
          processingPackageCheckIn: false,
          hasPackageCheckInResult: false,
          hasExistingRegularBookingOverride: false,
        })
      ).toBe(true)
    })

    it("hides the overlay when quickRepeatEligible is true, taking precedence before any other check", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...base,
          loadingBootstrap: true,
          quickRepeatEligible: true,
        })
      ).toBe(false)
    })
  })

  describe("shouldShowPackageCheckInFailureOverlay", () => {
    const base = {
      isKioskTerminalFlow: true,
      mode: "existing" as const,
      hasActiveCustomerSession: true,
      hasPendingPinRotation: false,
      loadingBootstrap: false,
      hasBootstrap: true,
      hasPackage: true,
      hasPackageCheckInFailure: true,
      hasPackageOffer: false,
    }

    it("shows the failure overlay once a terminal package check-in failure is recorded", () => {
      expect(shouldShowPackageCheckInFailureOverlay(base)).toBe(true)
    })

    it("hides the failure overlay while no failure has been recorded", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasPackageCheckInFailure: false })).toBe(false)
    })

    it("does not show the failure overlay for non-kiosk flows", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, isKioskTerminalFlow: false })).toBe(false)
    })

    it("does not show the failure overlay outside the existing-customer mode", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, mode: "idle" })).toBe(false)
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, mode: "new" })).toBe(false)
    })

    it("does not show the failure overlay when there is no active customer session", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasActiveCustomerSession: false })).toBe(false)
    })

    it("hides the failure overlay while a kiosk PIN rotation step is still pending", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasPendingPinRotation: true })).toBe(false)
    })

    it("hides the failure overlay when quickRepeatEligible is true, matching the resolving overlay's precedence", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, quickRepeatEligible: true })).toBe(false)
    })

    it("hides the failure overlay when the duplicate-purchase popup should show instead", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasExistingPurchaseForSession: true })).toBe(false)
    })

    it("hides the failure overlay when the package offer screen is visible", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasPackageOffer: true })).toBe(false)
    })

    it("hides the failure overlay while bootstrap is still loading (nothing has failed yet)", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, loadingBootstrap: true })).toBe(false)
    })

    it("hides the failure overlay when bootstrap has not resolved", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasBootstrap: false })).toBe(false)
    })

    it("hides the failure overlay when the customer has no package for the current class", () => {
      expect(shouldShowPackageCheckInFailureOverlay({ ...base, hasPackage: false })).toBe(false)
    })
  })

  describe("resolving overlay vs. failure overlay — coexisting state", () => {
    const resolvingOverlayBase = {
      isKioskTerminalFlow: true,
      mode: "existing" as const,
      hasActiveCustomerSession: true,
      hasPendingPinRotation: false,
      loadingBootstrap: false,
      hasBootstrap: true,
      hasPackage: true,
      processingPackageCheckIn: false,
      hasPackageCheckInResult: false,
      hasExistingRegularBookingOverride: false,
      hasPackageOffer: false,
      paymentsStepReady: false,
    }

    it("renders the failure overlay (not the resolving overlay) once a package check-in failure is recorded", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...resolvingOverlayBase,
          hasVisibleError: false,
          hasPackageCheckInFailure: true,
        })
      ).toBe(false)
      expect(
        shouldShowPackageCheckInFailureOverlay({
          ...resolvingOverlayBase,
          hasPackageCheckInFailure: true,
        })
      ).toBe(true)
    })

    it("still shows the failure overlay when a stale hasVisibleError is also true (hasVisibleError intentionally not gated)", () => {
      expect(
        shouldShowPackageCheckInFailureOverlay({
          ...resolvingOverlayBase,
          hasPackageCheckInFailure: true,
        })
      ).toBe(true)
      // shouldShowPackageCheckInFailureOverlay's input type has no hasVisibleError field at all —
      // this test documents that a stale visibleError elsewhere in app state cannot suppress it.
      expect(
        shouldShowKioskResolvingOverlay({
          ...resolvingOverlayBase,
          hasVisibleError: true,
          hasPackageCheckInFailure: true,
        })
      ).toBe(false)
    })

    it("quickRepeatEligible: true yields false from BOTH gates", () => {
      expect(
        shouldShowKioskResolvingOverlay({
          ...resolvingOverlayBase,
          hasVisibleError: false,
          hasPackageCheckInFailure: true,
          quickRepeatEligible: true,
        })
      ).toBe(false)
      expect(
        shouldShowPackageCheckInFailureOverlay({
          ...resolvingOverlayBase,
          hasPackageCheckInFailure: true,
          quickRepeatEligible: true,
        })
      ).toBe(false)
    })
  })
})
