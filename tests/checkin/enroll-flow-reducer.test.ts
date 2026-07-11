import { describe, expect, it } from "vitest"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import { createInitialEnrollFlowState, enrollFlowReducer } from "@/components/front/courses/enroll/model/enroll-flow.reducer"
import {
  resolveFlowStepKeys,
  selectActiveStepKey,
  selectCanContinue,
  selectIsContactGateStep,
  selectKioskQrPending,
} from "@/components/front/courses/enroll/model/enroll-selectors"

const baseContact = {
  firstName: "Ana",
  lastName: "Diaz",
  email: "ana@example.com",
  phone: "+1 917 555 1212",
  note: "",
}

describe("enroll flow reducer", () => {
  const reduce = (actions: Parameters<typeof enrollFlowReducer>[1][]) => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 6 })
    return actions.reduce(enrollFlowReducer, initial)
  }

  it("clamps step inside bounds", () => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 3 })
    const reduced = enrollFlowReducer(initial, { type: "step/set", step: 9, maxStep: 3 })
    expect(reduced.step).toBe(3)
  })

  it("stores service/package/addons/participants selections", () => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 6 })

    const withService = enrollFlowReducer(initial, { type: "selection/set-service", service: "new-student" })
    const withPackage = enrollFlowReducer(withService, { type: "selection/set-package", pkg: "pkg-1" })
    const withAddons = enrollFlowReducer(withPackage, { type: "selection/set-addons", addons: ["addon-1"] })
    const withParticipants = enrollFlowReducer(withAddons, {
      type: "selection/set-participants",
      participants: 4,
    })

    expect(withParticipants.service).toBe("new-student")
    expect(withParticipants.pkg).toBe("pkg-1")
    expect(withParticipants.addons).toEqual(["addon-1"])
    expect(withParticipants.participants).toBe(4)
  })

  it("marks sign-in required and preserves resume intent", () => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 6 })
    const requiring = enrollFlowReducer(initial, {
      type: "sign-in/required",
      resumeStep: 2,
      purpose: "sms_verification",
      existingDetected: true,
    })

    expect(requiring.requiresSignIn).toBe(true)
    expect(requiring.resumeAfterSignInStep).toBe(2)
    expect(requiring.existingAccountDetected).toBe(true)
    expect(requiring.signInPurpose).toBe("sms_verification")
  })

  it("updates sign-in flags independently without forcing requiresSignIn", () => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 6 })
    const updated = enrollFlowReducer(initial, { type: "sign-in/set-existing-detected", value: true })
    const withPurpose = enrollFlowReducer(updated, { type: "sign-in/set-purpose", purpose: "account_preparation" })
    const withResume = enrollFlowReducer(withPurpose, { type: "sign-in/set-resume-step", resumeStep: 3 })

    expect(withResume.requiresSignIn).toBe(false)
    expect(withResume.existingAccountDetected).toBe(true)
    expect(withResume.signInPurpose).toBe("account_preparation")
    expect(withResume.resumeAfterSignInStep).toBe(3)
  })

  it("tracks kiosk qr phase container and completion state", () => {
    const initial = createInitialEnrollFlowState({ contact: baseContact, maxStep: 6 })
    const qrState = {
      ...createEmptyKioskQrCheckoutState(),
      phase: "waiting_for_payment" as const,
      sessionId: "sess_1",
    }

    const withQr = enrollFlowReducer(initial, { type: "kiosk/qr-state", state: qrState })
    const withSuccess = enrollFlowReducer(withQr, {
      type: "success/set",
      value: true,
      message: "Payment recorded successfully.",
    })

    expect(withQr.kioskQrCheckout.phase).toBe("waiting_for_payment")
    expect(selectKioskQrPending(withQr)).toBe(true)
    expect(withSuccess.success).toBe(true)
    expect(withSuccess.successMessage).toBe("Payment recorded successfully.")
  })

  it("preserves success message when message and success are set sequentially", () => {
    const reduced = reduce([
      { type: "field/set-success-message", value: "Payment completed" },
      { type: "field/set-success", value: true },
    ])

    expect(reduced.success).toBe(true)
    expect(reduced.successMessage).toBe("Payment completed")
  })

  it("keeps successMessage when success is set to false until message is explicitly cleared", () => {
    const reduced = reduce([
      { type: "field/set-success-message", value: "done" },
      { type: "field/set-success", value: true },
      { type: "field/set-success", value: false },
    ])

    expect(reduced.success).toBe(false)
    expect(reduced.successMessage).toBe("done")
  })

  it("does not re-enable stale success when sequentially clearing success then message", () => {
    const reduced = reduce([
      { type: "field/set-success-message", value: "done" },
      { type: "field/set-success", value: true },
      { type: "field/set-success", value: false },
      { type: "field/set-success-message", value: null },
    ])

    expect(reduced.success).toBe(false)
    expect(reduced.successMessage).toBeNull()
  })

  it("applies queued functional updaters in order", () => {
    const reduced = reduce([
      { type: "field/set-participants", value: () => 3 },
      { type: "field/set-participants", value: (prev) => prev + 2 },
    ])

    expect(reduced.participants).toBe(5)
  })
})

describe("enroll selectors", () => {
  it("reuses enroll-flow step keys and exposes active key", () => {
    const stepKeys = resolveFlowStepKeys({
      isCheckInFlow: true,
      isCheckInNewFlow: false,
      isKioskTerminalFlow: true,
      requiresPhotoStep: true,
      hasPackages: true,
      hasConsecutiveOffer: true,
    })

    // Existing-customer kiosk flow includes conditional photo/packages/
    // consecutive steps between info and payments.
    expect(stepKeys).toEqual(["info", "photo", "packages", "consecutive", "payments"])
  })

  it("can skip the contact info step for trusted profile booking flows", () => {
    const stepKeys = resolveFlowStepKeys({
      isCheckInFlow: false,
      isCheckInNewFlow: false,
      isKioskTerminalFlow: false,
      requiresPhotoStep: false,
      skipInfoStep: true,
    })

    expect(stepKeys).toEqual(["party", "datetime", "payments", "review"])
    expect(selectActiveStepKey(stepKeys, 1)).toBe("datetime")
    expect(selectActiveStepKey(stepKeys, 2)).toBe("payments")
  })

  it("keeps the consecutive promotion between date/time and payment for trusted profile booking flows", () => {
    const stepKeys = resolveFlowStepKeys({
      isCheckInFlow: false,
      isCheckInNewFlow: false,
      isKioskTerminalFlow: false,
      requiresPhotoStep: false,
      skipInfoStep: true,
      hasConsecutiveOffer: true,
    })

    expect(stepKeys).toEqual(["party", "datetime", "consecutive", "payments", "review"])
    expect(selectActiveStepKey(stepKeys, 2)).toBe("consecutive")
    expect(selectActiveStepKey(stepKeys, 3)).toBe("payments")
  })

  it("blocks continue on payments until valid payment method is selected", () => {
    const state = createInitialEnrollFlowState({ contact: baseContact, maxStep: 4 })

    expect(selectCanContinue({ state, activeStepKey: "payments", hasFormError: false, identityCheckBusy: false })).toBe(false)

    const withPayment = enrollFlowReducer(state, { type: "payment/set-method", paymentMethod: "stripe" })
    expect(
      selectCanContinue({
        state: withPayment,
        activeStepKey: "payments",
        hasFormError: false,
        identityCheckBusy: false,
      })
    ).toBe(true)
  })

  it("treats info as check-in contact gate unless sign-in modal is active", () => {
    const state = createInitialEnrollFlowState({ contact: baseContact, maxStep: 4 })

    expect(selectIsContactGateStep(state, "info", true)).toBe(true)

    const requiring = enrollFlowReducer(state, {
      type: "sign-in/required",
      resumeStep: 1,
      purpose: "existing",
      existingDetected: false,
    })

    expect(selectIsContactGateStep(requiring, "info", true)).toBe(false)
  })
})
