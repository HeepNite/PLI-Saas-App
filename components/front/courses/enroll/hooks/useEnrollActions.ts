"use client"
import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { PreparedAccountState, NewStudentVerifyResponse } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { EnrollStepKey } from "@/lib/checkin/enroll-flow"
import type { SignInPurpose } from "@/components/front/courses/enroll/model/enroll-flow.types"
import { validateEnrollBeforeSubmit } from "@/components/front/courses/enroll/model/enroll-validation"
import type { EnrollmentOption } from "@/constants/courses"
import type { Coupon, PaymentMethod } from "@/components/front/courses/types"
import type { KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import { useEnrollPaymentActions } from "@/components/front/courses/enroll/hooks/useEnrollPaymentActions"
import { useEnrollNavigationActions } from "@/components/front/courses/enroll/hooks/useEnrollNavigationActions"
import { useEnrollSubmitActions } from "@/components/front/courses/enroll/hooks/useEnrollSubmitActions"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type UseEnrollActionsInput = {
  course: { slug: string; title: string; enrollment: { services: EnrollmentOption[]; packages: EnrollmentOption[]; addons?: EnrollmentOption[] } }
  availableServices: EnrollmentOption[]
  service: string
  pkg: string
  addons: string[]
  participants: number
  date: string
  time: string
  contact: EnrollmentContact
  appliedCoupon: Coupon
  paymentMethod: PaymentMethod
  total: number
  photoFlowContext: string
  kioskSessionToken?: string | null
  checkInContextDate: string
  checkInContextTime: string
  checkInContextDuration: number
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
  isCheckInFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow: boolean
  isSignedIn: boolean | undefined
  processing: boolean
  identityCheckBusy: boolean
  requiresSignIn: boolean
  formError: string | null
  step: number
  steps: Array<{ key: string; label: string }>
  photoPolicy: PhotoPolicy
  photoSaved: boolean
  photoStepIndex: number
  promoStepIndex: number
  packagesStepIndex: number
  paymentsStepIndex: number
  infoStepIndex: number
  skipContactStep: boolean
  regularServiceId: string
  regularServicePrice: number
  usesPhasedInfoForm: boolean
  activeStepKey: EnrollStepKey | ""
  kioskInfoPhase: KioskInfoPhase
  activeNumericField: "phone" | null
  preparedAccount: PreparedAccountState | null
  pendingAutoPay: boolean
  signInPurpose: SignInPurpose
  onCloseAction: () => void
  onExistingUserDetected?: () => void
  onKioskSessionCreated?: (sessionId: string) => void
  kioskQrCheckout: KioskQrCheckoutState
  showKioskPaymentTransition: boolean
  kioskPaymentTransitionTimeoutRef: React.MutableRefObject<number | null>
  kioskPaymentTransitionStartedAtRef: React.MutableRefObject<number | null>
  stationCompletionTimeoutRef: React.MutableRefObject<number | null>
  kioskFastPathAdvanceTriggeredRef: React.MutableRefObject<boolean>
  kioskFastPathSubmitTriggeredRef: React.MutableRefObject<boolean>
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>
  verifyNewStudent: (phone: string, email: string) => Promise<string>
  markSmsVerified: () => void
  resetVerification: () => void
  verification: { onSmsSent: () => void }
  setService: SetState<string>
  setAddons: SetState<string[]>
  setParticipants: SetState<number>
  setDate: SetState<string>
  setTime: SetState<string>
  setContact: SetState<EnrollmentContact>
  setStep: SetState<number>
  setSuccess: SetState<boolean>
  setSuccessMessage: SetState<string | null>
  setProcessing: SetState<boolean>
  setFormError: SetState<string | null>
  setRequiresSignIn: SetState<boolean>
  setExistingAccountDetected: SetState<boolean>
  setResumeAfterSignInStep: SetState<number | null>
  setResumeContactFlowAfterSignIn: SetState<boolean>
  setPendingAutoPay: SetState<boolean>
  setKioskQrCheckout: SetState<KioskQrCheckoutState>
  setSignInPurpose: SetState<SignInPurpose>
  setIdentityCheckBusy: SetState<boolean>
  setPhoneTouched: SetState<boolean>
  setStripeClientSecret: SetState<string>
  setShowStripeModal: SetState<boolean>
  setCheckInScheduleNotice: SetState<string | null>
  setActiveNumericField: SetState<"phone" | null>
  setKioskInfoPhase: SetState<KioskInfoPhase>
  setPreparedAccount: SetState<PreparedAccountState | null>
  setPhotoSaved: SetState<boolean>
  setNewStudentFallbackPhoneKey: SetState<string | null>
  setFlowPopup: SetState<{ title: string; message: string } | null>
  setConsecutiveAccepted: SetState<boolean>
  setConsecutiveAddedCents: SetState<number>
  setConsecutiveChoiceMade: SetState<boolean>
  setShowKioskPaymentTransition: SetState<boolean>
  t: (key: string, params?: Record<string, unknown>) => string
}

export function useEnrollActions(input: UseEnrollActionsInput) {
  const {
    course, availableServices, service, pkg, addons, participants, date, time, contact,
    appliedCoupon, paymentMethod, total, photoFlowContext, kioskSessionToken, checkInContextDate,
    checkInContextTime, checkInContextDuration, consecutiveAccepted, consecutiveAddedCents,
    effectiveConsecutiveOffer, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow,
    isSignedIn, processing, step, steps,
    photoPolicy, photoSaved, photoStepIndex, promoStepIndex, packagesStepIndex, paymentsStepIndex, infoStepIndex,
    skipContactStep, regularServiceId, regularServicePrice, usesPhasedInfoForm, activeStepKey,
    kioskInfoPhase, activeNumericField, preparedAccount, pendingAutoPay, signInPurpose, onCloseAction,
    onExistingUserDetected, kioskQrCheckout,
    kioskPaymentTransitionTimeoutRef, kioskPaymentTransitionStartedAtRef, stationCompletionTimeoutRef,
    kioskFastPathAdvanceTriggeredRef, kioskFastPathSubmitTriggeredRef,
    getToken, verifyNewStudent, markSmsVerified, resetVerification, verification,
    setService, setAddons, setParticipants, setDate, setTime, setContact, setStep,
    setSuccess, setSuccessMessage, setProcessing, setFormError, setRequiresSignIn,
    setExistingAccountDetected, setResumeAfterSignInStep, setResumeContactFlowAfterSignIn,
    setPendingAutoPay, setKioskQrCheckout, setSignInPurpose, setIdentityCheckBusy, setPhoneTouched,
    setStripeClientSecret, setShowStripeModal, setCheckInScheduleNotice, setActiveNumericField,
    setKioskInfoPhase, setPreparedAccount, setPhotoSaved, setNewStudentFallbackPhoneKey,
    setFlowPopup, setConsecutiveAccepted, setConsecutiveAddedCents, setConsecutiveChoiceMade,
    setShowKioskPaymentTransition, t,
  } = input

  const validateBeforeSubmit = () =>
    validateEnrollBeforeSubmit({
      services: availableServices,
      packages: course.enrollment.packages,
      addons: course.enrollment.addons,
      serviceId: service,
      packageId: pkg,
      addonIds: addons,
      participants,
      date,
      time,
      contact,
      skipContactValidation: skipContactStep,
      contactStepIndex: infoStepIndex,
      paymentMethod,
      paymentsStepIndex,
      total,
    })

  const paymentActions = useEnrollPaymentActions({
    course, service, pkg, addons, participants, date, time, contact,
    appliedCoupon, paymentMethod, total, photoFlowContext, kioskSessionToken,
    checkInContextDate, checkInContextTime, checkInContextDuration,
    consecutiveAccepted, consecutiveAddedCents, effectiveConsecutiveOffer,
    isCheckInFlow, isKioskTerminalFlow, isSignedIn, processing, step,
    paymentsStepIndex, infoStepIndex, regularServiceId, regularServicePrice,
    pendingAutoPay: pendingAutoPay,
    getToken,
    setService, setStep, setSuccess, setSuccessMessage, setProcessing, setFormError,
    setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setPendingAutoPay,
    setKioskQrCheckout, setSignInPurpose, setStripeClientSecret, setShowStripeModal,
    setPreparedAccount, setNewStudentFallbackPhoneKey, setFlowPopup, setResumeContactFlowAfterSignIn,
    t,
  })

  const {
    buildCheckoutPayload,
    requestNewStudentOutcome,
    requestAccountPreparation,
    showRegularFallbackPopup,
    requestKioskCheckoutSession,
    completeDropInCheckInAfterCardPayment,
    startKioskQrCheckout,
    handleSubmit: handleSubmitInternal,
    resetKioskQrCheckout,
  } = paymentActions

  const handleSubmit = async (e?: React.FormEvent) => {
    await handleSubmitInternal(e, { validateBeforeSubmit })
  }

  const navigationActions = useEnrollNavigationActions({
    service, contact, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow, isSignedIn,
    step, steps, photoPolicy, photoSaved, photoStepIndex, promoStepIndex, packagesStepIndex, paymentsStepIndex,
    usesPhasedInfoForm, activeStepKey, kioskInfoPhase, activeNumericField, preparedAccount,
    onExistingUserDetected, verifyNewStudent, resetVerification,
    setContact, setStep, setFormError, setRequiresSignIn, setExistingAccountDetected,
    setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setPendingAutoPay, setSignInPurpose,
    setIdentityCheckBusy, setPhoneTouched, setActiveNumericField, setKioskInfoPhase, setAddons,
    requestAccountPreparation, requestNewStudentOutcome, showRegularFallbackPopup, handleSubmit,
  })

  const {
    handleNumpadDigit,
    handleNumpadBackspace,
    handleNumpadClear,
    advanceFromContactStep,
    handleFormStepSubmit,
    toggleAddon,
    formatPackageMeta,
  } = navigationActions

  const submitActions = useEnrollSubmitActions({
    isKioskTerminalFlow, regularServicePrice, signInPurpose, onCloseAction,
    kioskPaymentTransitionTimeoutRef, kioskPaymentTransitionStartedAtRef,
    kioskFastPathAdvanceTriggeredRef, kioskFastPathSubmitTriggeredRef,
    setSuccess, setSuccessMessage, setAddons, setParticipants, setDate, setTime,
    setContact, setStep, setCheckInScheduleNotice, setRequiresSignIn, setExistingAccountDetected,
    setResumeAfterSignInStep, setPendingAutoPay, setResumeContactFlowAfterSignIn,
    setIdentityCheckBusy, setPhoneTouched, setActiveNumericField, setKioskInfoPhase,
    setStripeClientSecret, setShowStripeModal, setKioskQrCheckout, setPreparedAccount,
    setPhotoSaved, setNewStudentFallbackPhoneKey, setFlowPopup, setSignInPurpose,
    setFormError, setProcessing, setShowKioskPaymentTransition, setConsecutiveAccepted,
    setConsecutiveAddedCents, setConsecutiveChoiceMade, showRegularFallbackPopup,
  })

  const { resetForm, handleClose, handleSignInDismiss } = submitActions

  return {
    buildCheckoutPayload,
    requestNewStudentOutcome,
    requestAccountPreparation,
    showRegularFallbackPopup,
    handleNumpadDigit,
    handleNumpadBackspace,
    handleNumpadClear,
    advanceFromContactStep,
    requestKioskCheckoutSession,
    completeDropInCheckInAfterCardPayment,
    startKioskQrCheckout,
    handleSubmit,
    resetKioskQrCheckout,
    toggleAddon,
    resetForm,
    handleClose,
    handleSignInDismiss,
    handleFormStepSubmit,
    formatPackageMeta,
  }
}
