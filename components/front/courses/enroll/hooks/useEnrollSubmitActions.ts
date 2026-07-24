"use client"
import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { SignInPurpose } from "@/components/front/courses/enroll/model/enroll-flow.types"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type UseEnrollSubmitActionsInput = {
  isKioskTerminalFlow: boolean
  regularServicePrice: number
  signInPurpose: SignInPurpose
  onCloseAction: () => void
  kioskPaymentTransitionTimeoutRef: React.MutableRefObject<number | null>
  kioskPaymentTransitionStartedAtRef: React.MutableRefObject<number | null>
  kioskFastPathAdvanceTriggeredRef: React.MutableRefObject<boolean>
  kioskFastPathSubmitTriggeredRef: React.MutableRefObject<boolean>
  setSuccess: SetState<boolean>
  setSuccessMessage: SetState<string | null>
  setAddons: SetState<string[]>
  setParticipants: SetState<number>
  setDate: SetState<string>
  setTime: SetState<string>
  setContact: SetState<EnrollmentContact>
  setStep: SetState<number>
  setCheckInScheduleNotice: SetState<string | null>
  setRequiresSignIn: SetState<boolean>
  setExistingAccountDetected: SetState<boolean>
  setResumeAfterSignInStep: SetState<number | null>
  setPendingAutoPay: SetState<boolean>
  setResumeContactFlowAfterSignIn: SetState<boolean>
  setIdentityCheckBusy: SetState<boolean>
  setPhoneTouched: SetState<boolean>
  setActiveNumericField: SetState<"phone" | null>
  setKioskInfoPhase: SetState<KioskInfoPhase>
  setStripeClientSecret: SetState<string>
  setShowStripeModal: SetState<boolean>
  setKioskQrCheckout: SetState<KioskQrCheckoutState>
  setPreparedAccount: SetState<PreparedAccountState | null>
  setPhotoSaved: SetState<boolean>
  setNewStudentFallbackPhoneKey: SetState<string | null>
  setFlowPopup: SetState<{ title: string; message: string } | null>
  setSignInPurpose: SetState<SignInPurpose>
  setFormError: SetState<string | null>
  setProcessing: SetState<boolean>
  setShowKioskPaymentTransition: SetState<boolean>
  setConsecutiveAccepted: SetState<boolean>
  setConsecutiveAddedCents: SetState<number>
  setConsecutiveChoiceMade: SetState<boolean>
  showRegularFallbackPopup: (message?: string) => void
}

export function useEnrollSubmitActions(input: UseEnrollSubmitActionsInput) {
  const {
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
  } = input

  const resetForm = React.useCallback(() => {
    if (kioskPaymentTransitionTimeoutRef.current !== null) {
      window.clearTimeout(kioskPaymentTransitionTimeoutRef.current)
      kioskPaymentTransitionTimeoutRef.current = null
    }
    setSuccess(false)
    setSuccessMessage(null)
    setAddons([])
    setParticipants(1)
    setDate("")
    setTime("")
    setContact({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" })
    setStep(0)
    setCheckInScheduleNotice(null)
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
    setResumeContactFlowAfterSignIn(false)
    setIdentityCheckBusy(false)
    setPhoneTouched(false)
    setActiveNumericField(isKioskTerminalFlow ? "phone" : null)
    setKioskInfoPhase(isKioskTerminalFlow ? "phone" : "name-email")
    setStripeClientSecret("")
    setShowStripeModal(false)
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
    setPreparedAccount(null)
    setPhotoSaved(false)
    setNewStudentFallbackPhoneKey(null)
    setFlowPopup(null)
    setSignInPurpose("existing")
    setFormError(null)
    setProcessing(false)
    setShowKioskPaymentTransition(false)
    setConsecutiveAccepted(false)
    setConsecutiveAddedCents(0)
    setConsecutiveChoiceMade(false)
    kioskPaymentTransitionStartedAtRef.current = null
    kioskFastPathAdvanceTriggeredRef.current = false
    kioskFastPathSubmitTriggeredRef.current = false
  }, [
    setAddons, setContact, setExistingAccountDetected, setFormError, setKioskQrCheckout,
    setParticipants, setProcessing, setRequiresSignIn, setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn, setSignInPurpose, setStep, setSuccess, setSuccessMessage,
    setCheckInScheduleNotice, setIdentityCheckBusy, setPhoneTouched, setActiveNumericField,
    setKioskInfoPhase, setStripeClientSecret, setShowStripeModal, setPreparedAccount,
    setPhotoSaved, setNewStudentFallbackPhoneKey, setFlowPopup, setConsecutiveAccepted,
    setConsecutiveAddedCents, setConsecutiveChoiceMade, setShowKioskPaymentTransition,
    setPendingAutoPay, isKioskTerminalFlow, kioskPaymentTransitionTimeoutRef,
    kioskPaymentTransitionStartedAtRef, kioskFastPathAdvanceTriggeredRef, kioskFastPathSubmitTriggeredRef,
  ])

  const handleClose = React.useCallback(() => {
    resetForm()
    onCloseAction()
  }, [onCloseAction, resetForm])

  const handleSignInDismiss = React.useCallback(() => {
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
    setResumeContactFlowAfterSignIn(false)
    setSignInPurpose("existing")
    if (signInPurpose === "sms_verification") {
      showRegularFallbackPopup(
        `Phone verification was not completed. We switched this booking to the regular $${regularServicePrice.toFixed(0)} price.`
      )
    }
  }, [
    regularServicePrice, setExistingAccountDetected, setRequiresSignIn, setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn, setSignInPurpose, showRegularFallbackPopup, signInPurpose,
    setPendingAutoPay,
  ])

  return {
    resetForm,
    handleClose,
    handleSignInDismiss,
  }
}
