import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { EnrollFlowAction, EnrollFlowState } from "./enroll-flow.types"

const resolveNext = <T>(current: T, value: T | ((prev: T) => T)): T =>
  typeof value === "function" ? (value as (prev: T) => T)(current) : value

const clampStep = (step: number, maxStep: number) => Math.max(0, Math.min(maxStep, Math.floor(step)))

const clampParticipants = (value: number) => {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(10, Math.floor(value)))
}

export const createInitialEnrollFlowState = (input: {
  step?: number
  maxStep: number
  service?: string
  pkg?: string
  addons?: string[]
  participants?: number
  contact: EnrollFlowState["contact"]
  paymentMethod?: EnrollFlowState["paymentMethod"]
}): EnrollFlowState => ({
  step: clampStep(input.step ?? 0, input.maxStep),
  service: input.service ?? "",
  pkg: input.pkg ?? "",
  addons: input.addons ?? [],
  participants: clampParticipants(input.participants ?? 1),
  contact: input.contact,
  paymentMethod: input.paymentMethod ?? "",
  requiresSignIn: false,
  existingAccountDetected: false,
  resumeAfterSignInStep: null,
  resumeContactFlowAfterSignIn: false,
  signInPurpose: "existing",
  kioskQrCheckout: createEmptyKioskQrCheckoutState(),
  processing: false,
  formError: null,
  success: false,
  successMessage: null,
})

export const enrollFlowReducer = (state: EnrollFlowState, action: EnrollFlowAction): EnrollFlowState => {
  switch (action.type) {
    case "step/set":
      return { ...state, step: clampStep(action.step, action.maxStep) }
    case "selection/set-service":
      return { ...state, service: action.service }
    case "selection/set-package":
      return { ...state, pkg: action.pkg }
    case "selection/set-addons":
      return { ...state, addons: action.addons }
    case "selection/set-participants":
      return { ...state, participants: clampParticipants(action.participants) }
    case "contact/set":
      return { ...state, contact: action.contact }
    case "payment/set-method":
      return { ...state, paymentMethod: action.paymentMethod }
    case "sign-in/required":
      return {
        ...state,
        requiresSignIn: true,
        existingAccountDetected: action.existingDetected,
        resumeAfterSignInStep: action.resumeStep,
        signInPurpose: action.purpose,
      }
    case "sign-in/resolved":
      return {
        ...state,
        requiresSignIn: false,
      }
    case "sign-in/set-required":
      return {
        ...state,
        requiresSignIn: action.value,
      }
    case "sign-in/set-existing-detected":
      return {
        ...state,
        existingAccountDetected: action.value,
      }
    case "sign-in/set-resume-step":
      return {
        ...state,
        resumeAfterSignInStep: action.resumeStep,
      }
    case "sign-in/set-purpose":
      return {
        ...state,
        signInPurpose: action.purpose,
      }
    case "sign-in/resume-contact":
      return {
        ...state,
        resumeContactFlowAfterSignIn: action.value,
      }
    case "kiosk/qr-state":
      return { ...state, kioskQrCheckout: action.state }
    case "kiosk/processing":
      return { ...state, processing: action.value }
    case "error/set":
      return { ...state, formError: action.message }
    case "success/set":
      return {
        ...state,
        success: action.value,
        successMessage: action.message,
      }
    case "field/set-service":
      return { ...state, service: resolveNext(state.service, action.value) }
    case "field/set-package":
      return { ...state, pkg: resolveNext(state.pkg, action.value) }
    case "field/set-addons":
      return { ...state, addons: resolveNext(state.addons, action.value) }
    case "field/set-participants":
      return { ...state, participants: clampParticipants(resolveNext(state.participants, action.value)) }
    case "field/set-contact":
      return { ...state, contact: resolveNext(state.contact, action.value) }
    case "field/set-payment-method":
      return { ...state, paymentMethod: resolveNext(state.paymentMethod, action.value) }
    case "field/set-step":
      return { ...state, step: clampStep(resolveNext(state.step, action.value), action.maxStep) }
    case "field/set-success": {
      const success = resolveNext(state.success, action.value)
      return { ...state, success }
    }
    case "field/set-success-message":
      return { ...state, successMessage: resolveNext(state.successMessage, action.value) }
    case "field/set-processing":
      return { ...state, processing: resolveNext(state.processing, action.value) }
    case "field/set-form-error":
      return { ...state, formError: resolveNext(state.formError, action.value) }
    case "field/set-sign-in-required":
      return { ...state, requiresSignIn: resolveNext(state.requiresSignIn, action.value) }
    case "field/set-existing-account-detected":
      return { ...state, existingAccountDetected: resolveNext(state.existingAccountDetected, action.value) }
    case "field/set-resume-after-sign-in-step":
      return { ...state, resumeAfterSignInStep: resolveNext(state.resumeAfterSignInStep, action.value) }
    case "field/set-resume-contact-flow":
      return { ...state, resumeContactFlowAfterSignIn: resolveNext(state.resumeContactFlowAfterSignIn, action.value) }
    case "field/set-kiosk-qr-checkout":
      return { ...state, kioskQrCheckout: resolveNext(state.kioskQrCheckout, action.value) }
    case "field/set-sign-in-purpose":
      return { ...state, signInPurpose: resolveNext(state.signInPurpose, action.value) }
  }
}
