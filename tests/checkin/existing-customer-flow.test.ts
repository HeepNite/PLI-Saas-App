import { describe, expect, it } from "vitest"
import {
  backoffDelays,
  classifyPackageCheckInFailure,
  getExistingCustomerInitialStep,
  getPackageCheckInResolvingMessage,
  hasExistingCustomerPrefillContact,
  isRetryablePackageFailure,
  resolveDuplicatePurchaseDoneAction,
  resolvePackageConsecutiveDeclineAction,
  shouldAutoOpenExistingPurchase,
  shouldAutoPromoteExistingMode,
  shouldSurfaceClosedWindowPackageError,
  shouldAutoTriggerPackageCheckIn,
  shouldShowCheckInQrPanel,
} from "@/lib/checkin/existing-customer-flow"

describe("existing customer kiosk helpers", () => {
  it("keeps kiosk customers on the contact step when the identity prefill is incomplete", () => {
    expect(getExistingCustomerInitialStep({ isKioskTerminalFlow: true, hasPrefilledContact: false })).toBe(0)
  })

  it("goes to payments when prefilled, no photo needed, no packages available", () => {
    // Steps: info(0) → payments(1)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: false,
      hasPackages: false,
    })).toBe(1)
  })

  it("goes to photo step when prefilled but needs photo", () => {
    // Steps: info(0) → photo(1) → payments(2)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: true,
      hasPackages: false,
    })).toBe(1) // photo step
  })

  it("goes to packages step when prefilled, packages available, but NO active package", () => {
    // Steps: info(0) → packages(1) → payments(2)
    // User doesn't have active package, so offer them packages
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: false,
      hasPackages: true,
      hasActivePackage: false,
    })).toBe(1) // packages step
  })

  it("skips packages to payments when prefilled and user HAS active package", () => {
    // Steps: info(0) → packages(1) → payments(2)
    // User already has package, skip to payments
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: false,
      hasPackages: true,
      hasActivePackage: true,
    })).toBe(2) // payments step (skipping packages)
  })

  it("goes to photo first when both photo and packages needed", () => {
    // Steps: info(0) → photo(1) → packages(2) → payments(3)
    // Photo comes before packages
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: true,
      hasPackages: true,
      hasActivePackage: false,
    })).toBe(1) // photo step first
  })

  it("keeps the non-kiosk entry step stable for the full wizard", () => {
    expect(getExistingCustomerInitialStep()).toBe(2)
  })

  it("requires full identified contact data before the kiosk flow skips ahead", () => {
    expect(
      hasExistingCustomerPrefillContact({
        firstName: "Jane",
        lastName: "Student",
        email: "jane@example.com",
        phone: "+1 555 111 2222",
      })
    ).toBe(true)
    expect(
      hasExistingCustomerPrefillContact({
        firstName: "",
        lastName: "Student",
        email: "jane@example.com",
        phone: "+1 555 111 2222",
      })
    ).toBe(false)
  })

  it("shows the QR panel for terminal shell on compact tablet viewports", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: true,
        isQrEntry: false,
        shellVariant: "terminal",
      })
    ).toBe(true)
  })

  it("keeps the QR panel hidden for phone entry even on terminal shell", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: false,
        isQrEntry: true,
        shellVariant: "terminal",
      })
    ).toBe(false)
  })

  it("still hides the QR panel on compact personal QR viewports", () => {
    expect(
      shouldShowCheckInQrPanel({
        hideQrPanel: false,
        hasQrImage: true,
        isCompactViewport: true,
        isQrEntry: false,
        shellVariant: "qr",
      })
    ).toBe(false)
  })

  it("auto-opens the current class purchase after PIN identify when a kiosk session is active", () => {
    expect(
      shouldAutoOpenExistingPurchase({
        mode: "existing",
        hasBootstrap: true,
        isSignedIn: false,
        hasKioskPinSession: true,
        loadingBootstrap: false,
        hasExistingRegularBookingOverride: false,
        openNewBooking: false,
        processingPackageCheckIn: false,
        hasPackage: false,
      })
    ).toBe(true)
  })

  it("does not auto-promote kiosk terminals to existing mode from the staff Clerk session", () => {
    expect(
      shouldAutoPromoteExistingMode({
        entryMode: null,
        mode: "idle",
        hasActiveClerkSession: true,
        isKioskTerminalFlow: true,
      })
    ).toBe(false)
  })

  it("still auto-promotes personal QR users with an active Clerk session", () => {
    expect(
      shouldAutoPromoteExistingMode({
        entryMode: null,
        mode: "idle",
        hasActiveClerkSession: true,
        isKioskTerminalFlow: false,
      })
    ).toBe(true)
  })

  it("honors explicit existing entry mode even on kiosk terminals", () => {
    expect(
      shouldAutoPromoteExistingMode({
        entryMode: "existing",
        mode: "idle",
        hasActiveClerkSession: false,
        isKioskTerminalFlow: true,
      })
    ).toBe(true)
  })

  it("does not auto-open when the student already has a package for the class", () => {
    expect(
      shouldAutoOpenExistingPurchase({
        mode: "existing",
        hasBootstrap: true,
        isSignedIn: false,
        hasKioskPinSession: true,
        loadingBootstrap: false,
        hasExistingRegularBookingOverride: false,
        openNewBooking: false,
        processingPackageCheckIn: false,
        hasPackage: true,
      })
    ).toBe(false)
  })

  it("blocks kiosk package auto-trigger while the package success state is still visible", () => {
    expect(
      shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasPackage: true,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: true,
        effectiveCheckInWindowOpen: true,
        hasActiveSession: true,
        hasConsecutiveOffer: false,
        consecutiveOfferSettled: true,
      })
    ).toBe(false)
  })

  it("still allows kiosk package auto-trigger once the success state is cleared", () => {
    expect(
      shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasPackage: true,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        effectiveCheckInWindowOpen: true,
        hasActiveSession: true,
        hasConsecutiveOffer: false,
        consecutiveOfferSettled: true,
      })
    ).toBe(true)
  })

  it("does not auto-trigger package success when the student is already checked in for the session", () => {
    expect(
      shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasPackage: true,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        hasExistingPurchaseForSession: true,
        effectiveCheckInWindowOpen: true,
        hasActiveSession: true,
        hasConsecutiveOffer: false,
        consecutiveOfferSettled: true,
      })
    ).toBe(false)
  })

  it("surfaces a closed-window error instead of leaving the customer on loading", () => {
    expect(
      shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasBootstrap: true,
        hasPackage: true,
        effectiveCheckInWindowOpen: false,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        hasExistingRegularBookingOverride: false,
      })
    ).toBe(true)
  })

  it("does not surface the closed-window error once the purchase modal is already open", () => {
    expect(
      shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasBootstrap: true,
        hasPackage: true,
        effectiveCheckInWindowOpen: false,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        hasExistingRegularBookingOverride: true,
      })
    ).toBe(false)
  })

  it("does not re-assert the closed-window error while a manual Retry has just cleared it", () => {
    expect(
      shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasBootstrap: true,
        hasPackage: true,
        effectiveCheckInWindowOpen: false,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        hasExistingRegularBookingOverride: false,
        hasPackageCheckInFailure: true,
      })
    ).toBe(false)
  })

  it("still surfaces the closed-window error when hasPackageCheckInFailure is omitted (defaults to false, preserves today's behavior)", () => {
    expect(
      shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow: true,
        mode: "existing",
        hasBootstrap: true,
        hasPackage: true,
        effectiveCheckInWindowOpen: false,
        processingPackageCheckIn: false,
        hasPackageCheckInResult: false,
        hasExistingRegularBookingOverride: false,
      })
    ).toBe(true)
  })

  describe("shouldAutoTriggerPackageCheckIn — retry gating", () => {
    const baseTriggerInput = {
      isKioskTerminalFlow: true,
      mode: "existing" as const,
      hasPackage: true,
      processingPackageCheckIn: false,
      hasPackageCheckInResult: false,
      effectiveCheckInWindowOpen: true,
      hasActiveSession: true,
      hasConsecutiveOffer: false,
      consecutiveOfferSettled: true,
    }

    it("defaults new fields (omitted) to preserve today's behavior — allows auto-trigger", () => {
      expect(shouldAutoTriggerPackageCheckIn(baseTriggerInput)).toBe(true)
    })

    it("allows one more automatic attempt while attempts remain within the default budget of 3", () => {
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, attemptCount: 1 })).toBe(true)
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, attemptCount: 2 })).toBe(true)
    })

    it("stops auto-triggering once the retry budget is exhausted", () => {
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, attemptCount: 3, maxAttempts: 3 })).toBe(false)
    })

    it("stops auto-triggering once a terminal failure has been recorded", () => {
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, hasTerminalFailure: true })).toBe(false)
    })

    it("blocks a new automatic attempt while a backoff delay is pending, even if an unrelated dependency changes", () => {
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, retryBackoffActive: true })).toBe(false)
      expect(
        shouldAutoTriggerPackageCheckIn({
          ...baseTriggerInput,
          retryBackoffActive: true,
          hasConsecutiveOffer: true,
          consecutiveOfferSettled: false,
        })
      ).toBe(false)
    })

    it("honors a custom maxAttempts budget", () => {
      expect(shouldAutoTriggerPackageCheckIn({ ...baseTriggerInput, attemptCount: 1, maxAttempts: 1 })).toBe(false)
    })
  })

  describe("classifyPackageCheckInFailure", () => {
    it("classifies an aborted request as timeout", () => {
      expect(classifyPackageCheckInFailure({ kind: "timeout" })).toEqual({
        kind: "timeout",
        message: "We couldn't check you in. Please see the front desk.",
      })
    })

    it("classifies a fetch throw as network", () => {
      expect(classifyPackageCheckInFailure({ kind: "network" })).toEqual({
        kind: "network",
        message: "We couldn't check you in. Please see the front desk.",
      })
    })

    it("classifies a parseable 5xx body as a retryable server failure", () => {
      expect(
        classifyPackageCheckInFailure({
          kind: "http",
          status: 500,
          body: { error: "Unable to check in with package" },
        })
      ).toEqual({ kind: "server", message: "We couldn't check you in. Please see the front desk." })
    })

    it("classifies an unparseable 5xx body as unknown (not retryable)", () => {
      expect(classifyPackageCheckInFailure({ kind: "http", status: 500, body: null })).toEqual({
        kind: "unknown",
        message: "We couldn't check you in. Please see the front desk.",
      })
    })

    it("classifies 401/403/404 as unknown, surfacing the server message when present", () => {
      expect(classifyPackageCheckInFailure({ kind: "http", status: 401, body: { error: "Unauthorized" } })).toEqual({
        kind: "unknown",
        message: "Unauthorized",
      })
      expect(classifyPackageCheckInFailure({ kind: "http", status: 403, body: null })).toEqual({
        kind: "unknown",
        message: "We couldn't check you in. Please see the front desk.",
      })
      expect(classifyPackageCheckInFailure({ kind: "http", status: 404, body: { error: "Course not found" } })).toEqual({
        kind: "unknown",
        message: "Course not found",
      })
    })

    it("discriminates a closed check-in window structurally, by opensAt/closesAt fields, not message text", () => {
      expect(
        classifyPackageCheckInFailure({
          kind: "http",
          status: 409,
          body: {
            error: "Check-in is closed for this class.",
            opensAt: "2026-07-07T18:00:00.000Z",
            closesAt: "2026-07-07T19:00:00.000Z",
          },
        })
      ).toEqual({ kind: "closed_window", message: "Check-in is closed for this class." })
    })

    it("classifies the exact 'no active package' 409 copy as no_package", () => {
      expect(
        classifyPackageCheckInFailure({
          kind: "http",
          status: 409,
          body: { error: "No active package available for this class." },
        })
      ).toEqual({ kind: "no_package", message: "No active package available for this class." })
    })

    it("classifies the exact 'no credits left' 409 copy as no_credits", () => {
      expect(
        classifyPackageCheckInFailure({
          kind: "http",
          status: 409,
          body: { error: "This package has no credits left." },
        })
      ).toEqual({ kind: "no_credits", message: "This package has no credits left." })
    })

    it("degrades an unrecognized 409 shape to unknown instead of throwing", () => {
      expect(
        classifyPackageCheckInFailure({ kind: "http", status: 409, body: { error: "Some future conflict" } })
      ).toEqual({ kind: "unknown", message: "Some future conflict" })
    })

    it("parses a valid Retry-After header into a capped retryAfterMs", () => {
      expect(
        classifyPackageCheckInFailure({
          kind: "http",
          status: 429,
          body: { error: "Too many requests. Please try again in a moment." },
          retryAfterHeader: "5",
        })
      ).toEqual({
        kind: "rate_limited",
        message: "We couldn't check you in. Please see the front desk.",
        retryAfterMs: 5000,
      })
    })

    it("caps a Retry-After header above the 60-second rate-limit window", () => {
      expect(
        classifyPackageCheckInFailure({ kind: "http", status: 429, body: null, retryAfterHeader: "120" })
      ).toEqual({
        kind: "rate_limited",
        message: "We couldn't check you in. Please see the front desk.",
        retryAfterMs: 60000,
      })
    })

    it("falls back to no retryAfterMs when the header is missing or unparseable", () => {
      expect(classifyPackageCheckInFailure({ kind: "http", status: 429, body: null })).toEqual({
        kind: "rate_limited",
        message: "We couldn't check you in. Please see the front desk.",
      })
      expect(
        classifyPackageCheckInFailure({ kind: "http", status: 429, body: null, retryAfterHeader: "not-a-number" })
      ).toEqual({
        kind: "rate_limited",
        message: "We couldn't check you in. Please see the front desk.",
      })
    })
  })

  describe("isRetryablePackageFailure", () => {
    it("treats timeout, network, server, and rate_limited as retryable", () => {
      expect(isRetryablePackageFailure("timeout")).toBe(true)
      expect(isRetryablePackageFailure("network")).toBe(true)
      expect(isRetryablePackageFailure("server")).toBe(true)
      expect(isRetryablePackageFailure("rate_limited")).toBe(true)
    })

    it("treats closed_window, no_package, no_credits, client_precondition, and unknown as terminal", () => {
      expect(isRetryablePackageFailure("closed_window")).toBe(false)
      expect(isRetryablePackageFailure("no_package")).toBe(false)
      expect(isRetryablePackageFailure("no_credits")).toBe(false)
      expect(isRetryablePackageFailure("client_precondition")).toBe(false)
      expect(isRetryablePackageFailure("unknown")).toBe(false)
    })
  })

  describe("getPackageCheckInResolvingMessage", () => {
    it("returns undefined on the first attempt", () => {
      expect(getPackageCheckInResolvingMessage({ attempt: 1, maxAttempts: 3 })).toBeUndefined()
    })

    it("returns attempt-progress copy from the second attempt on", () => {
      expect(getPackageCheckInResolvingMessage({ attempt: 2, maxAttempts: 3 })).toBe(
        "Still checking you in… (attempt 2 of 3)"
      )
      expect(getPackageCheckInResolvingMessage({ attempt: 3, maxAttempts: 3 })).toBe(
        "Still checking you in… (attempt 3 of 3)"
      )
    })
  })

  it("trims the backoff schedule to the two reachable entries", () => {
    expect(backoffDelays).toEqual([0, 2000])
  })

  describe("resolvePackageConsecutiveDeclineAction", () => {
    it("returns 'pre-checkin' when the package check-in has not happened yet", () => {
      // Pre-checkin mode: the consecutive offer was shown BEFORE class A
      // check-in. Declining must trigger class A check-in (and surface the
      // standard package success overlay) rather than completing the station
      // immediately — otherwise the kiosk wipes packageCheckInResult before
      // the operator sees confirmation.
      expect(
        resolvePackageConsecutiveDeclineAction({ hasPackageCheckInResult: false })
      ).toBe("pre-checkin")
    })

    it("returns 'post-checkin' when the package check-in already completed", () => {
      // Post-checkin mode: class A was already checked in (legacy flow path).
      // Declining the offer just dismisses the overlay and completes the
      // station.
      expect(
        resolvePackageConsecutiveDeclineAction({ hasPackageCheckInResult: true })
      ).toBe("post-checkin")
    })
  })

  describe("resolveDuplicatePurchaseDoneAction", () => {
    it("opens the consecutive overlay only when a usable current-class package exists", () => {
      expect(
        resolveDuplicatePurchaseDoneAction({
          hasConsecutiveOffer: true,
          hasPackage: true,
        })
      ).toBe("open-consecutive-overlay")
    })

    it("completes the station when an offer exists but there is no usable current-class package", () => {
      expect(
        resolveDuplicatePurchaseDoneAction({
          hasConsecutiveOffer: true,
          hasPackage: false,
        })
      ).toBe("complete-station")
    })

    it("completes the station when there is no consecutive offer", () => {
      expect(
        resolveDuplicatePurchaseDoneAction({
          hasConsecutiveOffer: false,
          hasPackage: true,
        })
      ).toBe("complete-station")
    })
  })
})
