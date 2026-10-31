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
import { completeNativePaymentLifecycle } from "@/components/front/courses/enroll/native-payment-completion"
import { createKioskSessionCheckoutPayloadFields } from "@/lib/checkin/enroll-flow"
import {
  NATIVE_PREPARE_FAILED_MESSAGE,
  NATIVE_READER_UNRESPONSIVE_MESSAGE,
  runNativePreparedCheckout,
} from "@/components/front/courses/enroll/native-prepared-checkout"
import {
  isNativeKioskWebView,
  isNativePaymentBridgeAvailable,
  recoverNativeKioskBridge,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"
import {
  requestCheckoutCashApi,
  requestCheckoutIntentApi,
  requestCheckoutQuoteApi,
  requestNewStudentOutcomeApi,
  requestPublicPackageReservationApi,
} from "@/components/front/courses/enroll/effects/checkout-api"
import { requestCheckoutSessionApi, requestDropInCheckInApi } from "@/lib/checkin/checkin-qr-api"
import { formatRegularPricePhrase } from "@/components/front/courses/utils/package-pricing"

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
  /** Amount actually charged (checkout promotion applied); defaults to `total`. */
  displayTotal?: number
  photoFlowContext: string
  kioskSessionToken?: string | null
  checkInContextDate: string
  checkInContextTime: string
  checkInContextDuration: number
  bookingSource?: "public_booking"
  heritagePinCountryCode?: string
  kioskQrCashGrant?: string
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
  isCheckInFlow: boolean
  isCheckInExistingFlow: boolean
  isKioskTerminalFlow: boolean
  isProfileBookingFlow: boolean
  isSignedIn: boolean | undefined
  processing: boolean
  step: number
  paymentsStepIndex: number
  infoStepIndex: number
  regularServiceId: string
  regularServicePrice: number | null
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
  onNativePaymentApproved?: () => void
  // Narrowed to the exact keys this hook calls, with no vars/params (matches the actual
  // call sites below), so the live useI18n().t-typed by a strict key union and an
  // I18nVars-shaped second argument-remains assignable here without widening the real
  // translator's parameter type project-wide.
  t: (key: "account_exists_signed_in" | "account_exists_error") => string
}

type CheckoutApiResult = Awaited<ReturnType<typeof requestCheckoutSessionApi>>

/**
 * Sends one checkout request; when a signed-in customer gets 409 ACCOUNT_EXISTS it
 * retries exactly once with a freshly minted token after 350 ms. Returns the final
 * result, the token last used, and the response code of the FIRST attempt.
 */
const requestWithAccountRetry = async (
  { isSignedIn, getToken }: Pick<UseEnrollPaymentActionsInput, "isSignedIn" | "getToken">,
  request: (token: string | null) => Promise<CheckoutApiResult>
) => {
  let token = isSignedIn ? await getToken({ skipCache: true }) : null
  let result = await request(token)
  const initialCode: string | undefined = typeof result.data?.code === "string" ? result.data.code : undefined
  if (result.res.status === 409 && initialCode === "ACCOUNT_EXISTS" && isSignedIn) {
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    const refreshed = await getToken({ skipCache: true })
    if (refreshed) {
      token = refreshed
      result = await request(token)
    }
  }
  return { result, token, initialCode }
}

export function useEnrollPaymentActions(input: UseEnrollPaymentActionsInput) {
  const {
    course, service, pkg, addons, participants, date, time, contact,
    appliedCoupon, paymentMethod, total, displayTotal = total, photoFlowContext, kioskSessionToken,
    checkInContextDate, checkInContextTime, checkInContextDuration,
    bookingSource, heritagePinCountryCode, kioskQrCashGrant, consecutiveAccepted, consecutiveAddedCents, effectiveConsecutiveOffer,
    isCheckInFlow, isCheckInExistingFlow, isKioskTerminalFlow, isProfileBookingFlow, isSignedIn, processing, step,
    paymentsStepIndex, regularServiceId, regularServicePrice,
    getToken,
    setService, setStep, setSuccess, setSuccessMessage, setProcessing, setFormError,
    setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setPendingAutoPay,
    setKioskQrCheckout, setStripeClientSecret, setShowStripeModal,
    setPreparedAccount, setNewStudentFallbackPhoneKey, setFlowPopup,
    onNativePaymentApproved, t,
  } = input
  const nativeAttemptRef = React.useRef(false)
  const nativeResetTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (nativeResetTimeoutRef.current !== null) window.clearTimeout(nativeResetTimeoutRef.current)
  }, [])

  const completeNativePayment = React.useCallback(() => {
    nativeResetTimeoutRef.current = completeNativePaymentLifecycle({
      total: displayTotal,
      setProcessing,
      setSuccess,
      setSuccessMessage,
      onComplete: () => {
        nativeResetTimeoutRef.current = null
        nativeAttemptRef.current = false
        onNativePaymentApproved?.()
      },
    })
  }, [displayTotal, onNativePaymentApproved, setProcessing, setSuccess, setSuccessMessage])

  const isPublicQuoteEligible =
    bookingSource === "public_booking" &&
    step === paymentsStepIndex &&
    !isKioskTerminalFlow &&
    !isProfileBookingFlow &&
    !isCheckInExistingFlow
  const [publicQuote, setPublicQuote] = React.useState<{
    amountCents: number
    currency: string
    promotionLabel?: string
  } | null>(null)
  const [publicQuoteLoading, setPublicQuoteLoading] = React.useState(false)
  const [publicQuoteError, setPublicQuoteError] = React.useState<string | null>(null)
  const publicQuoteRequest = React.useRef(0)

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
        extra: {
          ...(bookingSource === "public_booking"
            ? { bookingSource, ...(heritagePinCountryCode ? { heritagePinCountryCode } : {}) }
            : {}),
          ...(kioskQrCashGrant ? { kioskQrCashGrant } : {}),
          ...extra,
        },
      }),
    [
      addons,
      appliedCoupon,
      contact,
      consecutiveAccepted,
      consecutiveAddedCents,
      effectiveConsecutiveOffer,
      course,
      date,
      participants,
      photoFlowContext,
      checkInContextDate,
      checkInContextTime,
      bookingSource,
      heritagePinCountryCode,
      kioskQrCashGrant,
      pkg,
      kioskSessionToken,
      service,
      time,
      total,
    ]
  )

  React.useEffect(() => {
    const requestId = ++publicQuoteRequest.current
    let active = true

    if (!isPublicQuoteEligible) {
      setPublicQuote(null)
      setPublicQuoteLoading(false)
      setPublicQuoteError(null)
      return () => {
        active = false
      }
    }

    setPublicQuote(null)
    setPublicQuoteLoading(true)
    setPublicQuoteError(null)

    void (async () => {
      try {
        const token = isSignedIn ? await getToken({ skipCache: true }) : null
        const { res, data } = await requestCheckoutQuoteApi({
          token,
          payload: buildCheckoutPayload(),
        })
        if (!active || publicQuoteRequest.current !== requestId) return
        if (
          !res.ok ||
          !data ||
          !("amountCents" in data) ||
          typeof data.amountCents !== "number" ||
          !Number.isFinite(data.amountCents) ||
          typeof data.currency !== "string"
        ) {
          setPublicQuoteError("We couldn't refresh the current price. Please try again.")
          return
        }
        setPublicQuote(data)
      } catch {
        if (active && publicQuoteRequest.current === requestId) {
          setPublicQuoteError("We couldn't refresh the current price. Please try again.")
        }
      } finally {
        if (active && publicQuoteRequest.current === requestId) {
          setPublicQuoteLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [buildCheckoutPayload, getToken, isPublicQuoteEligible, isSignedIn])

  React.useEffect(() => {
    const target = window as typeof window & { pliNativeAttemptState?: unknown }
    if (!isKioskTerminalFlow || "pliNativeAttemptState" in target) return
    const unresolved = { state: "payment_unresolved" as const }
    const reader = async () => {
      try {
        const response = await fetch("/api/checkout/native-attempt-state", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(buildCheckoutPayload({ kioskCurrentCourseDuration: checkInContextDuration })) })
        const value: unknown = await response.json()
        if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) return unresolved
        const record = value as Record<string, unknown>
        return Object.keys(record).length === 1 && typeof record.state === "string" && ["absent", "pending_without_payment", "payment_unresolved", "paid", "rejected"].includes(record.state) ? { state: record.state as typeof unresolved.state } : unresolved
      } catch { return unresolved }
    }
    target.pliNativeAttemptState = reader
    return () => { if (target.pliNativeAttemptState === reader) delete target.pliNativeAttemptState }
  }, [buildCheckoutPayload, checkInContextDuration, isKioskTerminalFlow])

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

  const requestAccountPreparation = React.useCallback(async (
    options: { refreshKioskPreparedContext?: boolean } = {}
  ): Promise<PreparedAccountState | null> => {
    const { res, data } = await requestCheckoutIntentApi({
      payload: buildCheckoutPayload({
        prepareOnly: true,
        ...(isKioskTerminalFlow ? { paymentSurface: "embedded" } : {}),
        ...(options.refreshKioskPreparedContext === true
          ? { refreshKioskPreparedContext: true, kioskCurrentCourseDuration: checkInContextDuration }
          : {}),
      }),
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
  }, [buildCheckoutPayload, checkInContextDuration, isKioskTerminalFlow, setFormError, setPreparedAccount])

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
          `We switched this booking to the ${formatRegularPricePhrase(regularServicePrice)}. Continue without restarting the flow.`,
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

    const { result } = await requestWithAccountRetry({ isSignedIn, getToken }, requestKioskCheckoutSession)

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

  const clearSignInPrompt = () => {
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
  }

  /**
   * Shared not-ok handling for the hosted, profile, intent and cash checkouts. The
   * per-branch differences stay explicit through the options:
   * - `code`: card branches pass the post-retry code, cash passes the pre-retry code.
   * - `message`: the error shown for a plain failure (each branch builds its own).
   * - `phoneFallback`: profile checkouts never take the phone-verification fallback.
   * - `signedInAccountExists`: card branches show `account_exists_signed_in` when a
   *   signed-in customer still hits ACCOUNT_EXISTS; cash asks for sign-in instead.
   */
  const handleCheckoutFailure = (
    data: CheckoutApiResult["data"],
    options: { code: string | undefined; message: string; phoneFallback: boolean; signedInAccountExists: boolean }
  ) => {
    const error = typeof data?.error === "string" ? data.error : null
    const needsSignIn = !isCheckInFlow && options.code === "ACCOUNT_EXISTS"
    const isNewStudentBlocked =
      options.code === "NEW_STUDENT_ALREADY" || (error !== null && error.toLowerCase().includes("new student price"))
    const needsPhoneFallback =
      options.phoneFallback && isCheckInFlow && error !== null && error.toLowerCase().includes("phone verification")
    if (options.signedInAccountExists && needsSignIn && isSignedIn) {
      setFormError(t("account_exists_signed_in"))
      clearSignInPrompt()
      setProcessing(false)
      return
    }
    if (isNewStudentBlocked || needsPhoneFallback) {
      clearSignInPrompt()
      setProcessing(false)
      showRegularFallbackPopup(
        isNewStudentBlocked
          ? `This customer is not eligible for the new-student price. We switched the booking to the ${formatRegularPricePhrase(regularServicePrice)}.`
          : `Phone verification was not completed. We switched the booking to the ${formatRegularPricePhrase(regularServicePrice)}.`
      )
      return
    }
    setFormError(needsSignIn ? null : options.message)
    setRequiresSignIn(needsSignIn)
    setExistingAccountDetected(needsSignIn)
    setResumeAfterSignInStep(needsSignIn ? (paymentsStepIndex >= 0 ? paymentsStepIndex : step) : null)
    setPendingAutoPay(needsSignIn)
    setProcessing(false)
  }

  const cardFailureMessage = (data: CheckoutApiResult["data"]) =>
    typeof data?.error === "string" ? data.error : "Error starting card payment."

  const handleSubmit = async (
    e?: React.FormEvent,
    deps?: {
      validateBeforeSubmit: () => { message: string; step: number } | null
    }
  ) => {
    if (e) e.preventDefault()
    if (processing || nativeAttemptRef.current) return
    setFormError(null)
    if (deps) {
      const validationIssue = deps.validateBeforeSubmit()
      if (validationIssue) {
        setFormError(validationIssue.message)
        setStep(validationIssue.step)
        return
      }
    }
    const requiresPublicQuote =
      bookingSource === "public_booking" &&
      !isKioskTerminalFlow &&
      !isProfileBookingFlow &&
      !isCheckInExistingFlow &&
      paymentMethod === "stripe"
    if (requiresPublicQuote && (publicQuoteLoading || !publicQuote || publicQuoteError)) {
      setFormError(publicQuoteError || "We're confirming the current price. Please try again.")
      return
    }
    setProcessing(true)

    if (paymentMethod === "stripe" && isKioskTerminalFlow && !isNativePaymentBridgeAvailable()) {
      if (isNativeKioskWebView()) {
        recoverNativeKioskBridge()
        setFormError("Card reader connection is unavailable. Reopen the PLI app and try again.")
        setProcessing(false)
        return
      }
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

    if (
      bookingSource === "public_booking" &&
      isCheckInExistingFlow &&
      isSignedIn &&
      !pkg &&
      participants === 1 &&
      addons.length === 0 &&
      !appliedCoupon &&
      !consecutiveAccepted
    ) {
      try {
        const token = await getToken({ skipCache: true })
        const { res, data } = await requestPublicPackageReservationApi({
          token,
          payload: { courseSlug: course.slug, date, time },
        })
        if (res.ok && data?.ok === true) {
          setSuccessMessage("Class reserved with your package. Your credit will be used after attendance is completed.")
          setSuccess(true)
          setProcessing(false)
          return
        }
        if (!res.ok) {
          setFormError(
            typeof data?.error === "string"
              ? data.error
              : "We couldn't verify your package. Please try again."
          )
          setProcessing(false)
          return
        }
      } catch (error) {
        console.error("Unable to reserve public booking with package", error)
        setFormError("We couldn't verify your package. Please try again.")
        setProcessing(false)
        return
      }
    }

    // Mobile-QR check-in (new student OR existing customer, NOT the staff kiosk
    // terminal): use Stripe HOSTED checkout (full-page redirect) instead of the
    // embedded modal. The hosted page renders Apple Pay / Google Pay natively and
    // reliably on mobile, which the embedded element does not. The booking + check-in
    // completes server-side from the Stripe webhook (see /api/checkout/session +
    // /api/stripe/webhook); there is no post-redirect client callback.
    if (paymentMethod === "stripe" && isCheckInFlow && !isKioskTerminalFlow) {
      try {
        const buildHostedCheckoutPayload = () => buildCheckoutPayload({ checkInBooking: true })
        const endpoint = bookingSource === "public_booking" ? "/api/public/checkout/session" : undefined
        const { result } = await requestWithAccountRetry({ isSignedIn, getToken }, (token) =>
          requestCheckoutSessionApi({ token, payload: buildHostedCheckoutPayload(), endpoint })
        )
        if (!result.res.ok) {
          handleCheckoutFailure(result.data, {
            code: typeof result.data?.code === "string" ? result.data.code : undefined,
            message: cardFailureMessage(result.data),
            phoneFallback: true,
            signedInAccountExists: true,
          })
          return
        }
        if (typeof result.data?.url !== "string" || result.data.url.trim().length === 0) {
          throw new Error("Checkout session is missing the hosted redirect URL")
        }
        clearSignInPrompt()
        // Full-page redirect to Stripe hosted checkout. Keep `processing` true so the
        // submit button stays locked while the browser navigates away.
        window.location.href = result.data.url
        return
      } catch (err) {
        console.error(err)
        alert("We couldn't start the payment. Please try again.")
        setProcessing(false)
      }
      return
    }

    // Client profile bookings pay on Stripe's HOSTED checkout page (full-page
    // redirect) instead of the embedded PaymentElement modal — same reliability
    // and native Apple Pay / Google Pay as the mobile-QR check-in flow above. The
    // profile flow is not a check-in, so the purchase is finalized server-side by
    // the Stripe webhook and there is no post-redirect client callback.
    if (paymentMethod === "stripe" && isProfileBookingFlow) {
      try {
        const { result } = await requestWithAccountRetry({ isSignedIn, getToken }, (token) =>
          requestCheckoutSessionApi({ token, payload: buildCheckoutPayload(), endpoint: "/api/profile/checkout/session" })
        )
        if (!result.res.ok) {
          handleCheckoutFailure(result.data, {
            code: typeof result.data?.code === "string" ? result.data.code : undefined,
            message: cardFailureMessage(result.data),
            phoneFallback: false,
            signedInAccountExists: true,
          })
          return
        }
        if (typeof result.data?.url !== "string" || result.data.url.trim().length === 0) {
          throw new Error("Checkout session is missing the hosted redirect URL")
        }
        clearSignInPrompt()
        // Full-page redirect to Stripe hosted checkout. Keep `processing` true so the
        // submit button stays locked while the browser navigates away.
        window.location.href = result.data.url
        return
      } catch (err) {
        console.error(err)
        alert("We couldn't start the payment. Please try again.")
        setProcessing(false)
      }
      return
    }

    if (paymentMethod === "stripe") {
      if (isKioskTerminalFlow && isNativePaymentBridgeAvailable()) {
        nativeAttemptRef.current = true
        const result = await runNativePreparedCheckout({
          refreshPreparedContext: async () => Boolean(await requestAccountPreparation({ refreshKioskPreparedContext: true })),
          requestPreparedPurchase: async () => requestCheckoutIntentApi({
            token: isSignedIn ? await getToken({ skipCache: true }) : null,
            payload: buildCheckoutPayload({
              paymentSurface: "native_m2_prepare",
              kioskCurrentCourseDuration: checkInContextDuration,
            }),
          }),
        })
        if (result.kind === "paid") {
          completeNativePayment()
          return
        }
        // Every non-paid native outcome releases the action with a visible error. It never
        // re-prepares automatically or falls back to another payment surface.
        if (result.kind === "prepare_failed") setFormError(NATIVE_PREPARE_FAILED_MESSAGE)
        if (result.kind === "reader_unresolved") setFormError(NATIVE_READER_UNRESPONSIVE_MESSAGE)
        nativeAttemptRef.current = false
        setProcessing(false)
        return
      }
      if (isKioskTerminalFlow) {
        recoverNativeKioskBridge()
        setFormError("Card reader connection is unavailable. Reopen the PLI app and try again.")
        setProcessing(false)
        return
      }
      try {
        const endpoint = bookingSource === "public_booking" ? "/api/public/checkout/intent" : undefined
        const { result } = await requestWithAccountRetry({ isSignedIn, getToken }, (token) =>
          requestCheckoutIntentApi({ token, payload: buildCheckoutPayload({}), endpoint })
        )
        if (!result.res.ok) {
          handleCheckoutFailure(result.data, {
            code: typeof result.data?.code === "string" ? result.data.code : undefined,
            message: cardFailureMessage(result.data),
            phoneFallback: true,
            signedInAccountExists: true,
          })
          return
        }
        if (!result.data.clientSecret) throw new Error("Missing client secret")
        setStripeClientSecret(result.data.clientSecret)
        setShowStripeModal(true)
        clearSignInPrompt()
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
      const { result, token, initialCode } = await requestWithAccountRetry({ isSignedIn, getToken }, (nextToken) =>
        requestCheckoutCashApi({ token: nextToken, payload: buildCheckoutPayload({ cashNote: contact.note || undefined }) })
      )

      if (!result.res.ok) {
        handleCheckoutFailure(result.data, {
          // Cash decides on the pre-retry code (historical behaviour, pinned by tests).
          code: initialCode,
          message:
            typeof result.data?.error === "string" && result.data.error.trim().length > 0
              ? result.data.error
              : "Unable to register cash payment.",
          phoneFallback: true,
          signedInAccountExists: false,
        })
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
      clearSignInPrompt()
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
    publicQuote,
    publicQuoteLoading,
    publicQuoteError,
    handleSubmit,
    resetKioskQrCheckout,
  }
}
