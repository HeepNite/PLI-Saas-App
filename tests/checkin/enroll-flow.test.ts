import { describe, expect, it } from "vitest"
import {
  getCheckInSignInModalVariant,
  isCheckInContactGateStep,
  resolveEnrollInitialStep,
  resolvePostPhotoStepIndex,
  resolveEnrollStepKeys,
  shouldFetchConsecutiveOffer,
  shouldIncludePhotoStep,
  shouldRedirectPersonalCompletion,
} from "@/lib/checkin/enroll-flow"

describe("enroll flow helpers", () => {
  it("keeps the existing-customer flow on the requested info step", () => {
    expect(resolveEnrollInitialStep({ initialStep: 2, stepsLength: 5 })).toBe(2)
  })

  it("clamps an invalid initial step to the end of the flow", () => {
    expect(resolveEnrollInitialStep({ initialStep: 9, stepsLength: 4 })).toBe(3)
  })

  it("omits the photo step when the account already has an avatar", () => {
    expect(
      shouldIncludePhotoStep({
        isCheckInFlow: true,
        photoPolicyRequired: true,
        hasAvatar: true,
        photoSaved: false,
      })
    ).toBe(false)
  })

  it("keeps the photo step when the account still needs a photo", () => {
    expect(
      shouldIncludePhotoStep({
        isCheckInFlow: true,
        photoPolicyRequired: true,
        hasAvatar: false,
        photoSaved: false,
      })
    ).toBe(true)
  })

  it("starts kiosk new-customer check-in on info and hides party/datetime", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
      })
    ).toEqual(["info", "payments"])
  })

  it("starts kiosk existing-customer check-in on info and hides party/datetime", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: true,
        requiresPhotoStep: true,
      })
    ).toEqual(["info", "photo", "payments"])
  })

  it("keeps the standard non-kiosk flow steps unchanged", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        requiresPhotoStep: true,
      })
    ).toEqual(["party", "datetime", "info", "photo", "payments", "review"])
  })

  it("adds the consecutive offer step before payments in standard booking flows", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        requiresPhotoStep: false,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["party", "datetime", "info", "consecutive", "payments", "review"])
  })

  it("places the consecutive offer between date/time and payment when contact is skipped", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        requiresPhotoStep: false,
        skipInfoStep: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["party", "datetime", "consecutive", "payments", "review"])
  })

  it("uses only payment for trusted QR mobile booking without a promotion", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
        skipInfoStep: true,
      })
    ).toEqual(["payments"])
  })

  it("uses promotion then payment for trusted QR mobile booking with a promotion", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
        skipInfoStep: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["consecutive", "payments"])
  })

  it("fetches consecutive offers for profile booking", () => {
    expect(
      shouldFetchConsecutiveOffer({
        isQrMobileCompactFlow: false,
        isCheckInFlow: false,
        isProfileBookingFlow: true,
      })
    ).toBe(true)
  })

  it("keeps QR mobile compact when wired through a check-in flow variant", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
        skipInfoStep: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["consecutive", "payments"])
  })

  it("collects contact before payment for signed-out QR mobile booking", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
      })
    ).toEqual(["info", "payments"])
  })

  it("supports photo and promotion before payment for signed-out QR mobile booking", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "photo", "consecutive", "payments"])
  })

  it("includes packages step in QR mobile compact flow when packages are available", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
        hasPackages: true,
      })
    ).toEqual(["info", "packages", "payments"])
  })

  it("includes packages step with photo and promotion in QR mobile compact flow", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: true,
        hasPackages: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "photo", "packages", "consecutive", "payments"])
  })

  it("skips packages step in QR mobile compact flow when no packages available", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: false,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: false,
        hasPackages: false,
      })
    ).toEqual(["info", "payments"])
  })

  it("uses the compact sign-in modal variant for check-in flows", () => {
    expect(getCheckInSignInModalVariant(true)).toBe("compact")
    expect(getCheckInSignInModalVariant(false)).toBe("sheet")
  })

  it("treats the info step as the semantic contact gate for check-in flows", () => {
    expect(isCheckInContactGateStep({ isCheckInFlow: true, activeStepKey: "info" })).toBe(true)
    expect(isCheckInContactGateStep({ isCheckInFlow: true, activeStepKey: "payments" })).toBe(false)
  })

  it("does not run the contact gate outside check-in flows", () => {
    expect(isCheckInContactGateStep({ isCheckInFlow: false, activeStepKey: "info" })).toBe(false)
  })

  it("redirects completed QR mobile personal bookings to the profile", () => {
    expect(shouldRedirectPersonalCompletion({ success: true, isPersonalCompletion: true })).toBe(true)
    expect(shouldRedirectPersonalCompletion({ success: false, isPersonalCompletion: true })).toBe(false)
    expect(shouldRedirectPersonalCompletion({ success: true, isPersonalCompletion: false })).toBe(false)
  })

  it("includes packages step in kiosk flow when hasPackages is true", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
        hasPackages: true,
      })
    ).toEqual(["info", "packages", "payments"])
  })

  it("includes packages step with photo in kiosk flow when both are needed", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: true,
        hasPackages: true,
      })
    ).toEqual(["info", "photo", "packages", "payments"])
  })

  it("skips packages step in kiosk flow when hasPackages is false", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
        hasPackages: false,
      })
    ).toEqual(["info", "payments"])
  })

  it("routes photo skip to packages before payments when packages are available", () => {
    expect(
      resolvePostPhotoStepIndex({
        currentStep: 1,
        packagesStepIndex: 2,
        paymentsStepIndex: 3,
        stepsLength: 4,
      })
    ).toBe(2)
  })

  it("routes photo skip to payments when packages are unavailable", () => {
    expect(
      resolvePostPhotoStepIndex({
        currentStep: 1,
        packagesStepIndex: -1,
        paymentsStepIndex: 2,
        stepsLength: 3,
      })
    ).toBe(2)
  })

  it("routes photo skip to the consecutive offer before payments when no packages are available", () => {
    expect(
      resolvePostPhotoStepIndex({
        currentStep: 1,
        packagesStepIndex: -1,
        consecutiveStepIndex: 2,
        paymentsStepIndex: 3,
        stepsLength: 4,
      })
    ).toBe(2)
  })
})
