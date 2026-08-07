"use client"
import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import type { EnrollStepKey } from "@/lib/checkin/enroll-flow"
import type { SignInPurpose } from "@/components/front/courses/enroll/model/enroll-flow.types"
import { isCompleteUSPhone } from "@/components/front/courses/utils/phone"
import { isEmail } from "@/lib/shared"
import {
  handleExistingUserDetected,
  isCheckInContactGateStep,
  resolvePostAccountStepIndex,
} from "@/lib/checkin/enroll-flow"
import { isPhotoRequiredForAccount } from "@/lib/checkin/photo-context-policy"
import { nextKioskInfoPhase, type KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import { appendPhoneDigit, removePhoneDigit } from "@/lib/checkin/numeric-keypad"
import type { NewStudentVerifyResponse, PreparedAccountState as PreparedAccountStateAlias } from "@/components/front/courses/enroll/types/enroll-modal-props"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type UseEnrollNavigationActionsInput = {
  service: string
  contact: EnrollmentContact
  isCheckInFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow: boolean
  isSignedIn: boolean | undefined
  step: number
  steps: Array<{ key: string; label: string }>
  photoPolicy: PhotoPolicy
  photoSaved: boolean
  photoStepIndex: number
  promotionDecisionStepIndex: number
  packagesStepIndex: number
  paymentsStepIndex: number
  usesPhasedInfoForm: boolean
  activeStepKey: EnrollStepKey | ""
  kioskInfoPhase: KioskInfoPhase
  activeNumericField: "phone" | null
  preparedAccount: PreparedAccountState | null
  onExistingUserDetected?: () => void
  verifyNewStudent: (phone: string, email: string) => Promise<string>
  resetVerification: () => void
  setContact: SetState<EnrollmentContact>
  setStep: SetState<number>
  setFormError: SetState<string | null>
  setRequiresSignIn: SetState<boolean>
  setExistingAccountDetected: SetState<boolean>
  setResumeAfterSignInStep: SetState<number | null>
  setResumeContactFlowAfterSignIn: SetState<boolean>
  setPendingAutoPay: SetState<boolean>
  setSignInPurpose: SetState<SignInPurpose>
  setIdentityCheckBusy: SetState<boolean>
  setPhoneTouched: SetState<boolean>
  setActiveNumericField: SetState<"phone" | null>
  setKioskInfoPhase: SetState<KioskInfoPhase>
  setAddons: SetState<string[]>
  requestAccountPreparation: () => Promise<PreparedAccountStateAlias | null>
  requestNewStudentOutcome: () => Promise<NewStudentVerifyResponse | null>
  showRegularFallbackPopup: (message?: string) => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
}

export function useEnrollNavigationActions(input: UseEnrollNavigationActionsInput) {
  const {
    service, contact, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow, isSignedIn,
    step, steps, photoPolicy, photoSaved, photoStepIndex, promotionDecisionStepIndex, packagesStepIndex, paymentsStepIndex,
    usesPhasedInfoForm, activeStepKey, kioskInfoPhase, activeNumericField, preparedAccount,
    onExistingUserDetected, verifyNewStudent, resetVerification,
    setContact, setStep, setFormError, setRequiresSignIn, setExistingAccountDetected,
    setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setPendingAutoPay, setSignInPurpose,
    setIdentityCheckBusy, setPhoneTouched, setActiveNumericField, setKioskInfoPhase, setAddons,
    requestAccountPreparation, requestNewStudentOutcome, showRegularFallbackPopup, handleSubmit,
  } = input

  const handleNumpadDigit = React.useCallback((digit: string) => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: appendPhoneDigit(c.phone, digit) }))
      setPhoneTouched(true)
    }
  }, [activeNumericField, setContact, setPhoneTouched])

  const handleNumpadBackspace = React.useCallback(() => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: removePhoneDigit(c.phone) }))
    }
  }, [activeNumericField, setContact])

  const handleNumpadClear = React.useCallback(() => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: "+1 " }))
    }
  }, [activeNumericField, setContact])

  const advanceFromContactStep = React.useCallback(async () => {
    if (!isCheckInFlow) {
      setStep(step + 1)
      return
    }

    setIdentityCheckBusy(true)
    setFormError(null)
    try {
      // New-student check-in creates the Clerk account from this email, so a
      // malformed address (e.g. missing domain like "eg@fincom") must be caught
      // HERE — before we send the SMS and prepare the account — instead of
      // surfacing a confusing generic failure only after the server rejects it.
      if (
        service === "new-student" &&
        (isKioskTerminalFlow || isQrMobileCompactFlow) &&
        !isEmail(contact.email?.trim())
      ) {
        setFormError("Please enter a valid email address (e.g. name@example.com).")
        return
      }

      if (service === "new-student" && (isKioskTerminalFlow || isQrMobileCompactFlow) && isCompleteUSPhone(contact.phone)) {
        const result = await verifyNewStudent(contact.phone, contact.email)
        if (handleExistingUserDetected({ isKioskTerminalFlow, service, verifyResult: result, onExistingUserDetected })) {
          return
        }
        if (result === "sms_pending") {
          const account = await requestAccountPreparation()
          if (!account) {
            // Account preparation failed — the SMS verification screen was already
            // shown by verifyNewStudent (sms_pending). Without a prepared Clerk
            // account, EmbeddedSignIn's signIn.create would dead-end on
            // "Couldn't find your account." Dismiss the verification screen so the
            // user can correct and retry. requestAccountPreparation already set the
            // specific server error (e.g. invalid email), so we preserve it here
            // instead of overwriting with a generic message.
            resetVerification()
            return
          }
          return
        }
      } else if (service === "new-student" && !isKioskTerminalFlow && isCompleteUSPhone(contact.phone)) {
        const verifyResult = await requestNewStudentOutcome()
        if (!verifyResult) return
        if (verifyResult.shouldFallbackToRegular || verifyResult.outcome === "fallback_regular") {
          showRegularFallbackPopup(verifyResult.message)
          return
        }
        if (verifyResult.requiresSmsVerification || verifyResult.outcome === "requires_sms_verification") {
          const account = await requestAccountPreparation()
          if (!account) return
          if (!isSignedIn || account.requiresSignIn) {
            setSignInPurpose("sms_verification")
            setRequiresSignIn(true)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setResumeContactFlowAfterSignIn(true)
            return
          }
          const verifiedAgain = await requestNewStudentOutcome()
          if (!verifiedAgain || !(verifiedAgain.eligibleForNewStudent || verifiedAgain.outcome === "eligible")) {
            showRegularFallbackPopup(verifiedAgain?.message)
            return
          }
        }
      }

      const account = preparedAccount || (await requestAccountPreparation())
      if (!account) return

      if (
        photoPolicy.uploadMode === "customer_self" &&
        account.requiresSignIn &&
        !isSignedIn &&
        !isQrMobileCompactFlow
      ) {
        setSignInPurpose("account_preparation")
        setRequiresSignIn(true)
        setExistingAccountDetected(false)
        setResumeAfterSignInStep(null)
        setPendingAutoPay(false)
        setResumeContactFlowAfterSignIn(true)
        return
      }

      const needsPhoto = isPhotoRequiredForAccount(photoPolicy, Boolean(account.hasAvatar || photoSaved))
      if (needsPhoto && photoStepIndex >= 0) {
        setStep(photoStepIndex)
        return
      }
      const postAccountStepIndex = resolvePostAccountStepIndex({
        packagesStepIndex,
        promotionDecisionStepIndex,
        paymentsStepIndex,
      })
      if (postAccountStepIndex >= 0) {
        setStep(postAccountStepIndex)
        return
      }
    } finally {
      setIdentityCheckBusy(false)
    }
  }, [
    contact.email, contact.phone, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow,
    isSignedIn, onExistingUserDetected, packagesStepIndex, paymentsStepIndex, promotionDecisionStepIndex, photoPolicy,
    photoSaved, photoStepIndex, preparedAccount, requestAccountPreparation, requestNewStudentOutcome,
    setExistingAccountDetected, setFormError, setRequiresSignIn, setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn, setSignInPurpose, setStep, service, showRegularFallbackPopup,
    step, verifyNewStudent, resetVerification, setIdentityCheckBusy, setPendingAutoPay,
  ])

  const handleFormStepSubmit = async () => {
    if (usesPhasedInfoForm && activeStepKey === "info") {
      const nextPhase = nextKioskInfoPhase(kioskInfoPhase, service, { phoneFirst: isKioskTerminalFlow })
      if (nextPhase !== "done") {
        setKioskInfoPhase(nextPhase)
        // For phone-first kiosk, after phone → name-email (activate text input, not numpad)
        // For standard flow, after name-email → phone (activate numpad)
        if (isKioskTerminalFlow && nextPhase === "phone") setActiveNumericField("phone")
        else if (isKioskTerminalFlow && nextPhase === "name-email") setActiveNumericField(null)
        else if (isKioskTerminalFlow) setActiveNumericField("phone")
        return
      }
    }
    if (step < steps.length - 1) {
      if (isCheckInContactGateStep({ isCheckInFlow, activeStepKey })) {
        await advanceFromContactStep()
        return
      }
      setStep(step + 1)
      return
    }
    await handleSubmit()
  }

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const formatPackageMeta = React.useCallback((option?: { meta?: { cadence?: string; totalClasses?: number; makeUps?: number } | null; description?: string } | null) => {
    if (!option?.meta) return option?.description
    const parts: string[] = []
    if (option.meta.cadence) parts.push(option.meta.cadence)
    if (option.meta.totalClasses && option.meta.totalClasses > 0) parts.push(`${option.meta.totalClasses} classes`)
    if (option.meta.makeUps && option.meta.makeUps > 0) parts.push(`+${option.meta.makeUps} make-ups`)
    return parts.join(" • ") || option.description
  }, [])

  return {
    handleNumpadDigit,
    handleNumpadBackspace,
    handleNumpadClear,
    advanceFromContactStep,
    handleFormStepSubmit,
    toggleAddon,
    formatPackageMeta,
  }
}
