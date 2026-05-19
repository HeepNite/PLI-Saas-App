import { describe, expect, it } from "vitest"
import {
  getExistingCustomerInitialStep,
  hasExistingCustomerPrefillContact,
  resolvePackageConsecutiveDeclineAction,
  shouldAutoOpenExistingPurchase,
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
})
