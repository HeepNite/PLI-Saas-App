import React from "react"

import { requestCheckInBootstrapApi } from "@/lib/checkin/checkin-qr-api"
import type { ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type BookingOverride = { courseSlug: string; date: string; time: string } | null

type UseConsecutiveOfferLookupOptions = {
  isKioskTerminalFlow: boolean
  activeCourseSlug: string
  activeDate: string
  activeTime: string
  durationMinutes: number
  latePaymentEntryOverride: BookingOverride
  newBookingOverride: BookingOverride
  getToken: (options: { skipCache: boolean }) => Promise<string | null>
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  photoFlowContext: string
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  requestBootstrap?: typeof requestCheckInBootstrapApi
}

const hasUsablePackage = (data: unknown) => {
  const response = data as {
    package?: { isUnlimited?: boolean; remainingCredits?: number | null } | null
  } | null
  return Boolean(
    response?.package &&
      ((response.package.isUnlimited && response.package.remainingCredits == null) ||
        (response.package.remainingCredits ?? 0) > 0)
  )
}

export function useConsecutiveOfferLookup({
  isKioskTerminalFlow,
  activeCourseSlug,
  activeDate,
  activeTime,
  durationMinutes,
  latePaymentEntryOverride,
  newBookingOverride,
  getToken,
  hasActiveClerkSession,
  kioskPinSessionToken,
  photoFlowContext,
  setConsecutiveOffer,
  setShowConsecutivePaymentSelection,
  setShowConsecutiveOverlay,
  requestBootstrap = requestCheckInBootstrapApi,
}: UseConsecutiveOfferLookupOptions) {
  const checkConsecutiveOfferAfterCheckIn = React.useCallback(async (): Promise<boolean> => {
    if (!isKioskTerminalFlow) return false
    if (!activeCourseSlug) return false
    if (!hasActiveClerkSession && !kioskPinSessionToken) return false

    try {
      const token = await getToken({ skipCache: true })
      const courseSlug = latePaymentEntryOverride?.courseSlug ?? newBookingOverride?.courseSlug ?? activeCourseSlug
      const { res, data } = await requestBootstrap({
        token,
        payload: {
          courseSlug,
          date: latePaymentEntryOverride?.date ?? newBookingOverride?.date ?? activeDate,
          time: latePaymentEntryOverride?.time ?? newBookingOverride?.time ?? activeTime,
          durationMinutes,
          linkedFromCourseSlug: courseSlug,
          flowContext: photoFlowContext,
          ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        },
      })

      const offer = (data as { consecutiveOffer?: ConsecutiveOffer | null } | null)?.consecutiveOffer
      if (res.ok && hasUsablePackage(data) && offer) {
        setConsecutiveOffer(offer)
        setShowConsecutivePaymentSelection(false)
        setShowConsecutiveOverlay(true)
        return true
      }
    } catch {
      // Silently ignore — not critical
    }
    return false
  }, [activeCourseSlug, activeDate, activeTime, durationMinutes, getToken, hasActiveClerkSession, isKioskTerminalFlow, kioskPinSessionToken, latePaymentEntryOverride, newBookingOverride, photoFlowContext, requestBootstrap, setConsecutiveOffer, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  return { checkConsecutiveOfferAfterCheckIn }
}
