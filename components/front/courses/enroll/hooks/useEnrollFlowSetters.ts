"use client"
import React from "react"
import type { EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { EnrollFlowAction, EnrollFlowState } from "@/components/front/courses/enroll/model/enroll-flow.types"

export function useEnrollFlowSetters(dispatchFlow: React.Dispatch<EnrollFlowAction>, stepsLength: number) {
  const setService = React.useCallback((value: React.SetStateAction<string>) => {
    dispatchFlow({ type: "field/set-service", value })
  }, [dispatchFlow])

  const setPkg = React.useCallback((value: React.SetStateAction<string>) => {
    dispatchFlow({ type: "field/set-package", value })
  }, [dispatchFlow])

  const setAddons: React.Dispatch<React.SetStateAction<string[]>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-addons", value })
  }, [dispatchFlow])

  const setParticipants = React.useCallback((value: React.SetStateAction<number>) => {
    dispatchFlow({ type: "field/set-participants", value })
  }, [dispatchFlow])

  const setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-contact", value })
  }, [dispatchFlow])

  const setPaymentMethod = React.useCallback((value: React.SetStateAction<PaymentMethod>) => {
    dispatchFlow({ type: "field/set-payment-method", value })
  }, [dispatchFlow])

  const setStep = React.useCallback((value: React.SetStateAction<number>) => {
    dispatchFlow({ type: "field/set-step", value, maxStep: Math.max(0, stepsLength - 1) })
  }, [dispatchFlow, stepsLength])

  const setSuccess = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-success", value })
  }, [dispatchFlow])

  const setSuccessMessage = React.useCallback((value: React.SetStateAction<string | null>) => {
    dispatchFlow({ type: "field/set-success-message", value })
  }, [dispatchFlow])

  const setProcessing = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-processing", value })
  }, [dispatchFlow])

  const setFormError = React.useCallback((value: React.SetStateAction<string | null>) => {
    dispatchFlow({ type: "field/set-form-error", value })
  }, [dispatchFlow])

  const setRequiresSignIn = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-sign-in-required", value })
  }, [dispatchFlow])

  const setExistingAccountDetected = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-existing-account-detected", value })
  }, [dispatchFlow])

  const setResumeAfterSignInStep = React.useCallback((value: React.SetStateAction<number | null>) => {
    dispatchFlow({ type: "field/set-resume-after-sign-in-step", value })
  }, [dispatchFlow])

  const setResumeContactFlowAfterSignIn = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-resume-contact-flow", value })
  }, [dispatchFlow])

  const setKioskQrCheckout: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-kiosk-qr-checkout", value })
  }, [dispatchFlow])

  const setSignInPurpose = React.useCallback((value: React.SetStateAction<EnrollFlowState["signInPurpose"]>) => {
    dispatchFlow({ type: "field/set-sign-in-purpose", value })
  }, [dispatchFlow])

  return {
    setService,
    setPkg,
    setAddons,
    setParticipants,
    setContact,
    setPaymentMethod,
    setStep,
    setSuccess,
    setSuccessMessage,
    setProcessing,
    setFormError,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setKioskQrCheckout,
    setSignInPurpose,
  }
}
