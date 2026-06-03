import type { EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

export type FlowSetStateAction<T> = T | ((prev: T) => T)

export type SignInPurpose = "existing" | "sms_verification" | "account_preparation"

export type EnrollFlowState = {
  step: number
  service: string
  pkg: string
  addons: string[]
  participants: number
  contact: EnrollmentContact
  paymentMethod: PaymentMethod
  requiresSignIn: boolean
  existingAccountDetected: boolean
  resumeAfterSignInStep: number | null
  resumeContactFlowAfterSignIn: boolean
  signInPurpose: SignInPurpose
  kioskQrCheckout: KioskQrCheckoutState
  processing: boolean
  formError: string | null
  success: boolean
  successMessage: string | null
}

export type EnrollFlowAction =
  | { type: "step/set"; step: number; maxStep: number }
  | { type: "selection/set-service"; service: string }
  | { type: "selection/set-package"; pkg: string }
  | { type: "selection/set-addons"; addons: string[] }
  | { type: "selection/set-participants"; participants: number }
  | { type: "contact/set"; contact: EnrollmentContact }
  | { type: "payment/set-method"; paymentMethod: PaymentMethod }
  | { type: "sign-in/required"; resumeStep: number | null; purpose: SignInPurpose; existingDetected: boolean }
  | { type: "sign-in/resolved" }
  | { type: "sign-in/set-required"; value: boolean }
  | { type: "sign-in/set-existing-detected"; value: boolean }
  | { type: "sign-in/set-resume-step"; resumeStep: number | null }
  | { type: "sign-in/set-purpose"; purpose: SignInPurpose }
  | { type: "sign-in/resume-contact"; value: boolean }
  | { type: "kiosk/qr-state"; state: KioskQrCheckoutState }
  | { type: "kiosk/processing"; value: boolean }
  | { type: "error/set"; message: string | null }
  | { type: "success/set"; value: boolean; message: string | null }
  | { type: "field/set-service"; value: FlowSetStateAction<string> }
  | { type: "field/set-package"; value: FlowSetStateAction<string> }
  | { type: "field/set-addons"; value: FlowSetStateAction<string[]> }
  | { type: "field/set-participants"; value: FlowSetStateAction<number> }
  | { type: "field/set-contact"; value: FlowSetStateAction<EnrollmentContact> }
  | { type: "field/set-payment-method"; value: FlowSetStateAction<PaymentMethod> }
  | { type: "field/set-step"; value: FlowSetStateAction<number>; maxStep: number }
  | { type: "field/set-success"; value: FlowSetStateAction<boolean> }
  | { type: "field/set-success-message"; value: FlowSetStateAction<string | null> }
  | { type: "field/set-processing"; value: FlowSetStateAction<boolean> }
  | { type: "field/set-form-error"; value: FlowSetStateAction<string | null> }
  | { type: "field/set-sign-in-required"; value: FlowSetStateAction<boolean> }
  | { type: "field/set-existing-account-detected"; value: FlowSetStateAction<boolean> }
  | { type: "field/set-resume-after-sign-in-step"; value: FlowSetStateAction<number | null> }
  | { type: "field/set-resume-contact-flow"; value: FlowSetStateAction<boolean> }
  | { type: "field/set-kiosk-qr-checkout"; value: FlowSetStateAction<KioskQrCheckoutState> }
  | { type: "field/set-sign-in-purpose"; value: FlowSetStateAction<SignInPurpose> }
