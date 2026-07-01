"use client"
import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { PreparedAccountState, NewStudentVerifyResponse } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { EnrollStepKey } from "@/lib/checkin/enroll-flow"
import type { SignInPurpose } from "@/components/front/courses/enroll/model/enroll-flow.types"
import {
  createEmptyKioskQrCheckoutState,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
} from "@/lib/checkin/kiosk-qr-payment"
import { isCompleteUSPhone } from "@/components/front/courses/utils/phone"
import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"
import { isCheckInContactGateStep, handleExistingUserDetected, handleEmbeddedSignInSessionCreated } from "@/lib/checkin/enroll-flow"
import { isPhotoRequiredForAccount } from "@/lib/checkin/photo-context-policy"
import { buildEnrollCheckoutPayload } from "@/components/front/courses/enroll/model/checkout-payload"
import { validateEnrollBeforeSubmit } from "@/components/front/courses/enroll/model/enroll-validation"
import { createKioskSessionCheckoutPayloadFields } from "@/lib/checkin/enroll-flow"
import { nextKioskInfoPhase, type KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import { appendPhoneDigit, removePhoneDigit } from "@/lib/checkin/numeric-keypad"
import {
  requestCheckoutCashApi,
  requestCheckoutFinalizeApi,
  requestCheckoutIntentApi,
  requestCheckoutSessionApi,
  requestDropInCheckInApi,
  requestNewStudentOutcomeApi,
} from "@/components/front/courses/enroll/effects/checkout-api"
import type { EnrollmentOption } from "@/constants/courses"
import type { Coupon, PaymentMethod } from "@/components/front/courses/types"

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
    isSignedIn, processing, identityCheckBusy, requiresSignIn, formError, step, steps,
    photoPolicy, photoSaved, photoStepIndex, packagesStepIndex, paymentsStepIndex, infoStepIndex,
    skipContactStep, regularServiceId, regularServicePrice, usesPhasedInfoForm, activeStepKey,
    kioskInfoPhase, activeNumericField, preparedAccount, pendingAutoPay, signInPurpose, onCloseAction,
    onExistingUserDetected, onKioskSessionCreated, kioskQrCheckout, showKioskPaymentTransition,
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

  const buildCheckoutPayload = React.useCallback(
    (extra: Record<string, unknown> = {}) =>
      buildEnrollCheckoutPayload({
        course,
        total,
        date,
        time,
        contact,
        participants,
        addonIds: addons,
        appliedCoupon,
        packageId: pkg,
        serviceId: service,
        photoFlowContext,
        kioskSessionFields: createKioskSessionCheckoutPayloadFields(kioskSessionToken ?? undefined),
        checkInContextDate,
        checkInContextTime,
        consecutiveAccepted,
        consecutiveAddedCents,
        consecutiveOffer: effectiveConsecutiveOffer ?? undefined,
        extra,
      }),
    [
      addons,
      appliedCoupon?.code,
      contact.email,
      contact.firstName,
      contact.lastName,
      contact.phone,
      consecutiveAccepted,
      consecutiveAddedCents,
      effectiveConsecutiveOffer,
      course.slug,
      course.title,
      date,
      participants,
      photoFlowContext,
      checkInContextDate,
      checkInContextTime,
      infoStepIndex,
      pkg,
      kioskSessionToken,
      service,
      time,
      total,
    ]
  )

  const requestNewStudentOutcome = React.useCallback(async (): Promise<NewStudentVerifyResponse | null> => {
    const { res, data } = await requestNewStudentOutcomeApi({ phone: contact.phone })
    if (!res.ok || !data || typeof data.outcome !== "string") {
      setFormError(
        typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "We couldn't verify the customer's phone."
      )
      return null
    }
    return data as NewStudentVerifyResponse
  }, [contact.phone, setFormError])

  const requestAccountPreparation = React.useCallback(async (): Promise<PreparedAccountState | null> => {
    const { res, data } = await requestCheckoutIntentApi({
      payload: buildCheckoutPayload({ prepareOnly: true }),
    })
    const account = data?.account as PreparedAccountState | undefined
    if (!res.ok || !account || typeof account.hasAvatar !== "boolean") {
      setFormError(
        typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "We couldn't prepare the customer account."
      )
      return null
    }
    setPreparedAccount(account)
    return account
  }, [buildCheckoutPayload, setFormError, setPreparedAccount])

  const showRegularFallbackPopup = React.useCallback(
    (message?: string) => {
      const nextFallbackPhoneKey = normalizePhoneKey(contact.phone)
      if (nextFallbackPhoneKey) {
        setNewStudentFallbackPhoneKey(nextFallbackPhoneKey)
      }
      if (regularServiceId && regularServiceId !== service) {
        setService(regularServiceId)
      }
      setFlowPopup({
        title: "Regular price applied",
        message:
          message ||
          `We switched this booking to the regular $${regularServicePrice.toFixed(0)} price. Continue without restarting the flow.`,
      })
    },
    [contact.phone, regularServiceId, regularServicePrice, service, setService, setNewStudentFallbackPhoneKey, setFlowPopup]
  )

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
      if (service === "new-student" && (isKioskTerminalFlow || isQrMobileCompactFlow) && isCompleteUSPhone(contact.phone)) {
        const result = await verifyNewStudent(contact.phone, contact.email)
        if (handleExistingUserDetected({ isKioskTerminalFlow, service, verifyResult: result, onExistingUserDetected })) {
          return
        }
        if (result === "sms_pending") {
          const account = await requestAccountPreparation()
          if (!account) return
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
      if (packagesStepIndex >= 0) {
        setStep(packagesStepIndex)
        return
      }
      if (paymentsStepIndex >= 0) {
        setStep(paymentsStepIndex)
        return
      }
    } finally {
      setIdentityCheckBusy(false)
    }
  }, [
    contact.email, contact.phone, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow,
    isSignedIn, onExistingUserDetected, packagesStepIndex, paymentsStepIndex, photoPolicy,
    photoSaved, photoStepIndex, preparedAccount, requestAccountPreparation, requestNewStudentOutcome,
    setExistingAccountDetected, setFormError, setRequiresSignIn, setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn, setSignInPurpose, setStep, service, showRegularFallbackPopup,
    step, verifyNewStudent, setIdentityCheckBusy, setPendingAutoPay,
  ])

  const requestKioskCheckoutSession = React.useCallback(async (token?: string | null) => {
    const { res, data } = await requestCheckoutSessionApi({
      token,
      payload: buildCheckoutPayload(),
    })
    return { res, data }
  }, [buildCheckoutPayload])

  const completeDropInCheckInAfterCardPayment = React.useCallback(
    async ({ paymentIntentId, purchaseId }: { paymentIntentId?: string | null; purchaseId?: string | null }) => {
      if (!isCheckInFlow) return null
      if (pkg || !date || !time) {
        return "Purchase recorded successfully."
      }
      const resolvedPaymentIntentId = typeof paymentIntentId === "string" && paymentIntentId.trim().length > 0 ? paymentIntentId : null
      const resolvedPurchaseId = typeof purchaseId === "string" && purchaseId.trim().length > 0 ? purchaseId : null
      if (!resolvedPaymentIntentId && !resolvedPurchaseId) {
        return "Payment was completed, but check-in sync is still pending."
      }
      try {
        const { res: dropInRes, data: dropInData } = await requestDropInCheckInApi({
          payload: {
            ...(resolvedPaymentIntentId ? { paymentIntentId: resolvedPaymentIntentId } : {}),
            ...(resolvedPurchaseId ? { purchaseId: resolvedPurchaseId } : {}),
            courseSlug: course.slug,
            date,
            time,
            durationMinutes: checkInContextDuration,
          },
        })
        return dropInRes.ok
          ? "Purchase and check-in recorded successfully."
          : typeof dropInData?.error === "string"
            ? `Purchase recorded. Automatic check-in could not be completed: ${dropInData.error}`
            : "Purchase recorded. Automatic check-in could not be completed."
      } catch (error) {
        console.warn("Unable to complete automatic drop-in check-in", error)
        return "Payment was completed, but we couldn't confirm automatic check-in."
      }
    },
    [checkInContextDuration, course.slug, date, isCheckInFlow, pkg, time]
  )

  const startKioskQrCheckout = React.useCallback(async () => {
    setKioskQrCheckout((prev) => ({
      ...createEmptyKioskQrCheckoutState(),
      phase: "creating",
      error: prev.error,
    }))

    let token = isSignedIn ? await getToken({ skipCache: true }) : null
    let result = await requestKioskCheckoutSession(token)
    const code = typeof result.data?.code === "string" ? result.data.code : undefined

    if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      const refreshed = await getToken({ skipCache: true })
      if (refreshed) {
        token = refreshed
        result = await requestKioskCheckoutSession(token)
      }
    }

    if (!result.res.ok) {
      const message =
        typeof result.data?.error === "string" && result.data.error.trim().length > 0
          ? result.data.error
          : "Error starting QR checkout."
      setKioskQrCheckout({ ...createEmptyKioskQrCheckoutState(), phase: "error", error: message })
      setFormError(message)
      return false
    }

    if (typeof result.data?.url !== "string" || typeof result.data?.sessionId !== "string") {
      const message = "Checkout session is missing required data."
      setKioskQrCheckout({ ...createEmptyKioskQrCheckoutState(), phase: "error", error: message })
      setFormError(message)
      return false
    }

    setFormError(null)
    setKioskQrCheckout({
      phase: "qr_ready",
      sessionId: result.data.sessionId,
      url: result.data.url,
      expiresAt: typeof result.data?.expiresAt === "string" ? result.data.expiresAt : null,
      awaitingWebhook: false,
      purchaseId: null,
      paymentStatus: null,
      error: null,
    })
    return true
  }, [getToken, isSignedIn, requestKioskCheckoutSession, setFormError, setKioskQrCheckout])

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (processing) return
    setFormError(null)
    const validationIssue = validateBeforeSubmit()
    if (validationIssue) {
      setFormError(validationIssue.message)
      setStep(validationIssue.step)
      return
    }
    setProcessing(true)

    if (paymentMethod === "stripe" && isKioskTerminalFlow) {
      try {
        await startKioskQrCheckout()
      } catch (err) {
        console.error(err)
        setKioskQrCheckout({
          ...createEmptyKioskQrCheckoutState(),
          phase: "error",
          error: "We couldn't start the QR payment. Please try again.",
        })
        alert("We couldn't start the QR payment. Please try again.")
      } finally {
        setProcessing(false)
      }
      return
    }

    if (paymentMethod === "stripe") {
      try {
        let token = isSignedIn ? await getToken({ skipCache: true }) : null
        let result = await requestCheckoutIntentApi({ token, payload: buildCheckoutPayload() })
        const code = typeof result.data?.code === "string" ? result.data.code : undefined
        if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
          await new Promise((resolve) => window.setTimeout(resolve, 350))
          const refreshed = await getToken({ skipCache: true })
          if (refreshed) {
            token = refreshed
            result = await requestCheckoutIntentApi({ token, payload: buildCheckoutPayload() })
          }
        }
        if (!result.res.ok) {
          const finalCode = typeof result.data?.code === "string" ? result.data.code : undefined
          const needsSignIn = !isCheckInFlow && finalCode === "ACCOUNT_EXISTS"
          const isNewStudentBlocked =
            finalCode === "NEW_STUDENT_ALREADY" ||
            (typeof result.data?.error === "string" && result.data.error.toLowerCase().includes("new student price"))
          const needsPhoneFallback =
            isCheckInFlow &&
            typeof result.data?.error === "string" &&
            result.data.error.toLowerCase().includes("phone verification")
          if (needsSignIn && isSignedIn) {
            setFormError(t("account_exists_signed_in"))
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            return
          }
          if (isNewStudentBlocked) {
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            showRegularFallbackPopup(
              `This customer is not eligible for the new-student price. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
            )
            return
          }
          if (needsPhoneFallback) {
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            showRegularFallbackPopup(
              `Phone verification was not completed. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
            )
            return
          }
          const message =
            needsSignIn
              ? t("account_exists_error")
              : typeof result.data?.error === "string"
                ? result.data.error
                : "Error starting card payment."
          setFormError(needsSignIn ? null : message)
          setRequiresSignIn(needsSignIn)
          setExistingAccountDetected(needsSignIn)
          setResumeAfterSignInStep(needsSignIn ? (paymentsStepIndex >= 0 ? paymentsStepIndex : step) : null)
          setPendingAutoPay(needsSignIn)
          setProcessing(false)
          return
        }
        if (!result.data.clientSecret) throw new Error("Missing client secret")
        setStripeClientSecret(result.data.clientSecret)
        setShowStripeModal(true)
        setRequiresSignIn(false)
        setExistingAccountDetected(false)
        setResumeAfterSignInStep(null)
        setPendingAutoPay(false)
      } catch (err) {
        console.error(err)
        alert("We couldn't start the payment. Please try again.")
      } finally {
        setProcessing(false)
      }
      return
    }

    // Cash checkout
    try {
      let token = isSignedIn ? await getToken({ skipCache: true }) : null
      let result = await requestCheckoutCashApi({ token, payload: buildCheckoutPayload({ cashNote: contact.note || undefined }) })
      const code = typeof result.data?.code === "string" ? result.data.code : undefined

      if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
        const refreshed = await getToken({ skipCache: true })
        if (refreshed) {
          token = refreshed
          result = await requestCheckoutCashApi({ token, payload: buildCheckoutPayload({ cashNote: contact.note || undefined }) })
        }
      }

      if (!result.res.ok) {
        const isNewStudentBlocked =
          code === "NEW_STUDENT_ALREADY" ||
          (typeof result.data?.error === "string" && result.data.error.toLowerCase().includes("new student price"))
        const message =
          typeof result.data?.error === "string" && result.data.error.trim().length > 0
            ? result.data.error
            : "Unable to register cash payment."
        const needsPhoneFallback = isCheckInFlow && message.toLowerCase().includes("phone verification")
        const needsSignIn = !isCheckInFlow && code === "ACCOUNT_EXISTS"
        if (isNewStudentBlocked || needsPhoneFallback) {
          setRequiresSignIn(false)
          setExistingAccountDetected(false)
          setResumeAfterSignInStep(null)
          setPendingAutoPay(false)
          setProcessing(false)
          showRegularFallbackPopup(
            isNewStudentBlocked
              ? `This customer is not eligible for the new-student price. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
              : `Phone verification was not completed. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
          )
          return
        }
        setFormError(needsSignIn ? null : message)
        setRequiresSignIn(needsSignIn)
        setExistingAccountDetected(needsSignIn)
        setResumeAfterSignInStep(needsSignIn ? (paymentsStepIndex >= 0 ? paymentsStepIndex : step) : null)
        setPendingAutoPay(needsSignIn)
        setProcessing(false)
        return
      }

      let completionMessage =
        typeof result.data?.migration?.message === "string" && result.data.migration.message.trim().length > 0
          ? result.data.migration.message
          : "Cash request saved as pending confirmation."

      if (isCheckInFlow && !pkg && date && time && typeof result.data?.purchaseId === "string" && result.data?.paymentStatus !== "pending") {
        try {
          const { res: dropInRes, data: dropInData } = await requestDropInCheckInApi({
            token,
            payload: {
              purchaseId: result.data.purchaseId,
              courseSlug: course.slug,
              date,
              time,
              durationMinutes: checkInContextDuration,
            },
          })
          completionMessage = dropInRes.ok
            ? "Cash payment recorded and check-in completed successfully."
            : typeof dropInData?.error === "string"
              ? `Cash payment recorded. Automatic check-in could not be completed: ${dropInData.error}`
              : "Cash payment recorded. Automatic check-in could not be completed."
        } catch (error) {
          console.warn("Unable to complete automatic check-in for cash", error)
          completionMessage = "Cash payment recorded, but automatic check-in could not be completed."
        }
      }

      if (!isCheckInFlow && !isSignedIn && result.data?.account?.requiresSignIn) {
        completionMessage = "Cash request saved as pending confirmation. Sign in later to save your card and speed up future checkouts."
      } else if (!isCheckInFlow && result.data?.paymentStatus === "pending") {
        completionMessage = "Cash request saved. Staff must confirm the payment in admin before class access."
      }

      setSuccessMessage(completionMessage)
      setSuccess(true)
      setRequiresSignIn(false)
      setExistingAccountDetected(false)
      setResumeAfterSignInStep(null)
      setPendingAutoPay(false)
    } catch (err) {
      console.error(err)
      alert("We couldn't register the cash payment. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const resetKioskQrCheckout = React.useCallback(() => {
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
  }, [setKioskQrCheckout])

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

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

  const handleFormStepSubmit = async () => {
    if (usesPhasedInfoForm && activeStepKey === "info") {
      const nextPhase = nextKioskInfoPhase(kioskInfoPhase, service)
      if (nextPhase !== "done") {
        setKioskInfoPhase(nextPhase)
        if (isKioskTerminalFlow) setActiveNumericField("phone")
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

  const formatPackageMeta = React.useCallback((option?: { meta?: { cadence?: string; totalClasses?: number; makeUps?: number } | null; description?: string } | null) => {
    if (!option?.meta) return option?.description
    const parts: string[] = []
    if (option.meta.cadence) parts.push(option.meta.cadence)
    if (option.meta.totalClasses && option.meta.totalClasses > 0) parts.push(`${option.meta.totalClasses} classes`)
    if (option.meta.makeUps && option.meta.makeUps > 0) parts.push(`+${option.meta.makeUps} make-ups`)
    return parts.join(" • ") || option.description
  }, [])

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
