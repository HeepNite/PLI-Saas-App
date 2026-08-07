import { describe, expect, it } from "vitest"
import {
  getCheckInSignInModalVariant,
  isCheckInContactGateStep,
  resolvePostAccountStepIndex,
  resolveEnrollInitialStep,
  resolvePromotionDecisionStepIndex,
  resolvePostPhotoStepIndex,
  resolveEnrollStepKeys,
  shouldFetchConsecutiveOffer,
  shouldIncludePhotoStep,
  shouldPrefillClerkContact,
  shouldRedirectPersonalCompletion,
} from "@/lib/checkin/enroll-flow"

describe("enroll flow helpers", () => {
  it("keeps the existing-customer flow on the requested info step", () => {
    expect(resolveEnrollInitialStep({ initialStep: 2, stepsLength: 5 })).toBe(2)
  })

  it("resolves either promotion step key before payments", () => {
    expect(resolvePromotionDecisionStepIndex(["info", "promo", "payments"])).toBe(1)
    expect(resolvePromotionDecisionStepIndex(["info", "consecutive", "payments"])).toBe(1)
    expect(resolvePromotionDecisionStepIndex(["info", "payments"])).toBe(-1)
  })

  it("resolves the first post-account step from the actual flow order", () => {
    expect(
      resolvePostAccountStepIndex({
        packagesStepIndex: 1,
        promotionDecisionStepIndex: 2,
        paymentsStepIndex: 3,
      })
    ).toBe(1)
    expect(
      resolvePostAccountStepIndex({
        packagesStepIndex: -1,
        promotionDecisionStepIndex: 1,
        paymentsStepIndex: 2,
      })
    ).toBe(1)
    expect(
      resolvePostAccountStepIndex({
        packagesStepIndex: -1,
        promotionDecisionStepIndex: -1,
        paymentsStepIndex: -1,
      })
    ).toBe(-1)
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

  it("omits the photo step from check-in when the account still needs a photo", () => {
    expect(
      shouldIncludePhotoStep({
        isCheckInFlow: true,
        photoPolicyRequired: true,
        hasAvatar: false,
        photoSaved: false,
      })
    ).toBe(false)
  })

  // Kiosk "I'm new" flow now inserts a promo step between info and payments
  // (promo-window feature on develop): info → promo → payments.
  it("starts kiosk new-customer check-in on info + promo and hides party/datetime", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "promo", "payments"])
  })

  // Existing-customer kiosk flow keeps packages when available, but never Photo.
  it("omits the photo step for existing-customer kiosk check-in", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: false,
        isKioskTerminalFlow: true,
        requiresPhotoStep: true,
      })
    ).toEqual(["info", "payments"])
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

  it("rejects ambient Clerk contact only for shared kiosk new-student check-in", () => {
    expect(
      shouldPrefillClerkContact({
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
      })
    ).toBe(false)
    expect(
      shouldPrefillClerkContact({
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
      })
    ).toBe(true)
    expect(
      shouldPrefillClerkContact({
        isCheckInNewFlow: false,
        isKioskTerminalFlow: true,
      })
    ).toBe(true)
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

  it("omits photo from the production QR new-student check-in flow", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: false,
        isQrMobileCompactFlow: true,
        requiresPhotoStep: true,
        hasPackages: true,
      })
    ).toEqual(["info", "packages", "payments"])
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

  // New-customer kiosk flow ignores hasPackages/photo — packages are not a
  // separate step; the fixed flow is info → promo → payments.
  it("uses info/promo/payments in new kiosk flow regardless of hasPackages (packages are not a separate step in kiosk)", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
        hasPackages: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "promo", "payments"])
  })

  it("uses info/promo/payments in new kiosk flow even when both photo and packages are requested (both excluded from new kiosk flow)", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: true,
        hasPackages: true,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "promo", "payments"])
  })

  it("uses info/promo/payments in new kiosk flow when hasPackages is false", () => {
    expect(
      resolveEnrollStepKeys({
        isCheckInFlow: true,
        isCheckInNewFlow: true,
        isKioskTerminalFlow: true,
        requiresPhotoStep: false,
        hasPackages: false,
        hasConsecutiveOffer: true,
      })
    ).toEqual(["info", "promo", "payments"])
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
