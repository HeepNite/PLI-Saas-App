import { describe, expect, it } from "vitest"
import {
  getExistingCustomerInitialStep,
  hasExistingCustomerPrefillContact,
  shouldAutoOpenExistingPurchase,
  shouldAutoTriggerPackageCheckIn,
  shouldShowCheckInQrPanel,
} from "@/lib/checkin/existing-customer-flow"

describe("existing customer kiosk helpers", () => {
  it("keeps kiosk customers on the contact step when the identity prefill is incomplete", () => {
    expect(getExistingCustomerInitialStep({ isKioskTerminalFlow: true, hasPrefilledContact: false })).toBe(0)
  })

  it("skips to payments when the identified student is prefilled (no photo, no packages)", () => {
    // Steps: info(0) → payments(1)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: false,
      hasPackages: false,
      skipToPayments: true,
    })).toBe(1)
  })

  it("skips to payments accounting for photo step", () => {
    // Steps: info(0) → photo(1) → payments(2)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: true,
      hasPackages: false,
      skipToPayments: true,
    })).toBe(2)
  })

  it("skips to payments accounting for packages step", () => {
    // Steps: info(0) → packages(1) → payments(2)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: false,
      hasPackages: true,
      skipToPayments: true,
    })).toBe(2)
  })

  it("skips to payments accounting for both photo and packages steps", () => {
    // Steps: info(0) → photo(1) → packages(2) → payments(3)
    expect(getExistingCustomerInitialStep({
      isKioskTerminalFlow: true,
      hasPrefilledContact: true,
      requiresPhotoStep: true,
      hasPackages: true,
      skipToPayments: true,
    })).toBe(3)
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
      })
    ).toBe(true)
  })
})
