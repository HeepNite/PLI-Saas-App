import { isCheckInContactGateStep, resolveEnrollStepKeys, type EnrollStepKey } from "@/lib/checkin/enroll-flow"
import { isKioskQrPendingPhase } from "@/lib/checkin/kiosk-qr-payment"
import type { EnrollFlowState } from "./enroll-flow.types"

export const resolveFlowStepKeys = (input: {
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow?: boolean
  requiresPhotoStep: boolean
  skipInfoStep?: boolean
  hasPackages?: boolean
  hasConsecutiveOffer?: boolean
  isProfileBookingFlow?: boolean
}) => resolveEnrollStepKeys(input)

export const selectActiveStepKey = (stepKeys: EnrollStepKey[], step: number): EnrollStepKey | "" => stepKeys[step] || ""

export const selectIsContactGateStep = (state: EnrollFlowState, activeStepKey: EnrollStepKey | "", isCheckInFlow: boolean) =>
  isCheckInContactGateStep({ isCheckInFlow, activeStepKey }) && !state.requiresSignIn

export const selectCanContinue = (input: {
  state: EnrollFlowState
  activeStepKey: EnrollStepKey | ""
  hasFormError: boolean
  identityCheckBusy: boolean
}) => {
  if (input.state.processing || input.identityCheckBusy || input.state.requiresSignIn || input.hasFormError) {
    return false
  }
  if (input.activeStepKey === "payments") {
    return input.state.paymentMethod === "onsite" || input.state.paymentMethod === "stripe"
  }
  return true
}

export const selectKioskQrPending = (state: EnrollFlowState) => isKioskQrPendingPhase(state.kioskQrCheckout.phase)
