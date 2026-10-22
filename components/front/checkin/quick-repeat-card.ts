import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"
import { requestCheckoutIntentApi } from "@/components/front/courses/enroll/effects/checkout-api"
import { isNativePaymentBridgeAvailable } from "@/components/front/courses/enroll/effects/native-payment-bridge"
import { NATIVE_PAYMENT_SUCCESS_DISPLAY_MS } from "@/components/front/courses/enroll/native-payment-completion"
import {
  NATIVE_PREPARE_FAILED_MESSAGE,
  NATIVE_READER_UNRESPONSIVE_MESSAGE,
  runNativePreparedCheckout,
} from "@/components/front/courses/enroll/native-prepared-checkout"

/** Native WebView with a bridge charges on the M2 reader; anywhere else keeps the hosted QR. */
export const resolveQuickRepeatCardSurface = (): "native_m2" | "hosted_qr" =>
  isNativePaymentBridgeAvailable() ? "native_m2" : "hosted_qr"

/** Quick Repeat card checkout payload, shared by the hosted QR and native reader surfaces. */
export const buildQuickRepeatCardPayload = ({
  bootstrap,
  consecutiveAccepted,
  kioskSessionToken,
}: {
  bootstrap: BootstrapResponse
  consecutiveAccepted: boolean
  kioskSessionToken: string | null | undefined
}): Record<string, unknown> => {
  const { context, customer, lastPurchasePattern } = bootstrap
  const consecutiveOfferForCard = consecutiveAccepted ? (bootstrap.consecutiveOffer ?? null) : null
  const consecutivePriceCents = consecutiveOfferForCard
    ? (consecutiveOfferForCard.dropInConsecutiveCents ?? null)
    : null
  const totalAmountCents = (lastPurchasePattern?.amount ?? 0) + (consecutivePriceCents ?? 0)

  return {
    courseSlug: context.courseSlug,
    courseTitle: context.courseTitle,
    amount: totalAmountCents,
    currency: "usd",
    date: context.date,
    time: context.time,
    serviceId: lastPurchasePattern?.paymentChannel === "package" ? "package" : "dropin",
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    participants: 1,
    photoContext: "kiosk_terminal",
    ...(kioskSessionToken ? { kioskSessionToken } : {}),
    ...(consecutiveOfferForCard && consecutivePriceCents != null
      ? {
          consecutivePriceCents,
          consecutiveLinkedCourseSlug: consecutiveOfferForCard.linkedCourseSlug,
          consecutiveCourseTitle: consecutiveOfferForCard.linkedCourseTitle,
          consecutiveLinkedCourseTime: consecutiveOfferForCard.linkedCourseTime ?? context.time,
        }
      : {}),
  }
}

type QuickRepeatNativeCardInput = {
  payload: Record<string, unknown>
  kioskCurrentCourseDuration: number
  fetchImpl?: typeof fetch
  setProcessing: (value: boolean) => void
  setError: (message: string | null) => void
  /** Shows the Quick Repeat card success screen. */
  onPaid: () => void
  /** Runs after the success screen has been visible for the native display window. */
  onComplete: () => void
}

/**
 * Charges the Quick Repeat card total on the native M2 reader through the same prepared
 * sequence as the enroll flow. Non-paid outcomes surface an error and release the action;
 * they never re-prepare automatically or fall back to the hosted QR.
 */
export async function runQuickRepeatNativeCardCheckout({
  payload,
  kioskCurrentCourseDuration,
  fetchImpl,
  setProcessing,
  setError,
  onPaid,
  onComplete,
}: QuickRepeatNativeCardInput) {
  setError(null)
  setProcessing(true)
  const result = await runNativePreparedCheckout({
    refreshPreparedContext: async () => {
      const { res, data } = await requestCheckoutIntentApi({
        fetchImpl,
        payload: {
          ...payload,
          prepareOnly: true,
          paymentSurface: "embedded",
          refreshKioskPreparedContext: true,
          kioskCurrentCourseDuration,
        },
      })
      return res.ok && data?.preparedContextRefreshed === true
    },
    requestPreparedPurchase: () => requestCheckoutIntentApi({
      fetchImpl,
      payload: { ...payload, paymentSurface: "native_m2_prepare", kioskCurrentCourseDuration },
    }),
  })

  if (result.kind === "paid") {
    setProcessing(false)
    onPaid()
    window.setTimeout(onComplete, NATIVE_PAYMENT_SUCCESS_DISPLAY_MS)
    return
  }
  setError(result.kind === "reader_unresolved" ? NATIVE_READER_UNRESPONSIVE_MESSAGE : NATIVE_PREPARE_FAILED_MESSAGE)
  setProcessing(false)
}
