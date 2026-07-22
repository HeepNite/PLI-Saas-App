"use client"
import React from "react"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { PreparedAccountState, NewStudentVerifyResponse } from "@/components/front/courses/enroll/types/enroll-modal-props"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { SignInPurpose } from "@/components/front/courses/enroll/model/enroll-flow.types"
import type { PaymentMethod, Coupon } from "@/components/front/courses/types"
import type { EnrollmentOption } from "@/constants/courses"
import {
  createEmptyKioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"
import { buildEnrollCheckoutPayload } from "@/components/front/courses/enroll/model/checkout-payload"
import { createKioskSessionCheckoutPayloadFields } from "@/lib/checkin/enroll-flow"
import {
  requestCheckoutCashApi,
  requestCheckoutIntentApi,
  requestCheckoutSessionApi,
  requestDropInCheckInApi,
  requestNewStudentOutcomeApi,
} from "@/components/front/courses/enroll/effects/checkout-api"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type UseEnrollPaymentActionsInput = {
  course: { slug: string; title: string; enrollment: { services: EnrollmentOption[]; packages: EnrollmentOption[]; addons?: EnrollmentOption[] } }
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
  isSignedIn: boolean | undefined
  processing: boolean
  step: number
  paymentsStepIndex: number
  infoStepIndex: number
  regularServiceId: string
  regularServicePrice: number
  pendingAutoPay: boolean
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>
  setService: SetState<string>
  setStep: SetState<number>
  setSuccess: SetState<boolean>
  setSuccessMessage: SetState<string | null>
  setProcessing: SetState<boolean>
  setFormError: SetState<string | null>
  setRequiresSignIn: SetState<boolean>
  setExistingAccountDetected: SetState<boolean>
  setResumeAfterSignInStep: SetState<number | null>
  setPendingAutoPay: SetState<boolean>
  setKioskQrCheckout: SetState<KioskQrCheckoutState>
  setSignInPurpose: SetState<SignInPurpose>
  setStripeClientSecret: SetState<string>
  setShowStripeModal: SetState<boolean>
  setPreparedAccount: SetState<PreparedAccountState | null>
  setNewStudentFallbackPhoneKey: SetState<string | null>
  setFlowPopup: SetState<{ title: string; message: string } | null>
  setResumeContactFlowAfterSignIn: SetState<boolean>
  t: (key: string, params?: Record<string, unknown>) => string
}

export function useEnrollPaymentActions(input: UseEnrollPaymentActionsInput) {
  const {
    course, service, pkg, addons, participants, date, time, contact,
    appliedCoupon, paymentMethod, total, photoFlowContext, kioskSessionToken,
    checkInContextDate, checkInContextTime, checkInContextDuration,
    consecutiveAccepted, consecutiveAddedCents, effectiveConsecutiveOffer,
    isCheckInFlow, isKioskTerminalFlow, isSignedIn, processing, step,
    paymentsStepIndex, infoStepIndex, regularServiceId, regularServicePrice,
    getToken,
    setService, setStep, setSuccess, setSuccessMessage, setProcessing, setFormError,
    setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setPendingAutoPay,
    setKioskQrCheckout, setSignInPurpose, setStripeClientSecret, setShowStripeModal,
    setPreparedAccount, setNewStudentFallbackPhoneKey, setFlowPopup, setResumeContactFlowAfterSignIn,
    t,
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

  const handleSubmit = async (
    e?: React.FormEvent,
    deps?: {
      validateBeforeSubmit: () => { message: string; step: number } | null
    }
  ) => {
    if (e) e.preventDefault()
    if (processing) return
    setFormError(null)
    if (deps) {
      const validationIssue = deps.validateBeforeSubmit()
      if (validationIssue) {
        setFormError(validationIssue.message)
        setStep(validationIssue.step)
        return
      }
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

  return {
    buildCheckoutPayload,
    requestNewStudentOutcome,
    requestAccountPreparation,
    showRegularFallbackPopup,
    requestKioskCheckoutSession,
    completeDropInCheckInAfterCardPayment,
    startKioskQrCheckout,
    handleSubmit,
    resetKioskQrCheckout,
  }
}
