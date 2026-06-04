import React from "react"

import {
  resolvePackageConsecutiveAcceptAction,
  resolvePackageConsecutiveDeclineAction,
} from "@/lib/checkin/existing-customer-flow"
import {
  requestDropInCheckInApi,
  requestPackageCheckInApi,
} from "@/lib/checkin/checkin-qr-api"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type PackageCheckInResult = { attendanceId?: string | null; remainingCredits: number | null; points: number }

type UseConsecutiveOfferActionsOptions = {
  consecutiveOffer: ConsecutiveOffer | null
  activeDate: string
  activeTime: string
  durationMinutes: number
  getToken: (options: { skipCache: boolean }) => Promise<string | null>
  bootstrap: BootstrapResponse | null
  photoFlowContext: string
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  packageCheckInResult: PackageCheckInResult | null
  currentCheckInCourseSlug: string
  performPackageCheckInApi: () => Promise<PackageCheckInResult | null>
  openExistingPurchaseFlow: (context: { courseSlug: string; date: string; time: string }) => void
  handleStationCompletion: () => void | Promise<void>
  hasUsablePackageForCurrentClass: boolean
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  setConsecutiveError: (value: string | null) => void
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  setConsecutiveProcessing: (value: boolean) => void
  setConsecutiveProcessingAction: (value: "accept" | "decline" | "cash" | "card" | null) => void
  setConsecutiveSuccess: (value: { courseTitle: string } | null) => void
  setPackageCheckInResult: (value: PackageCheckInResult | null) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  requestPackageCheckIn?: typeof requestPackageCheckInApi
  requestDropInCheckIn?: typeof requestDropInCheckInApi
}

export function useConsecutiveOfferActions({
  consecutiveOffer,
  activeDate,
  activeTime,
  durationMinutes,
  getToken,
  bootstrap,
  photoFlowContext,
  hasActiveClerkSession,
  kioskPinSessionToken,
  packageCheckInResult,
  currentCheckInCourseSlug,
  performPackageCheckInApi,
  openExistingPurchaseFlow,
  handleStationCompletion,
  hasUsablePackageForCurrentClass,
  setAwaitingConsecutivePaymentSelection,
  setConsecutiveError,
  setConsecutiveOffer,
  setConsecutiveProcessing,
  setConsecutiveProcessingAction,
  setConsecutiveSuccess,
  setPackageCheckInResult,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  requestPackageCheckIn = requestPackageCheckInApi,
  requestDropInCheckIn = requestDropInCheckInApi,
}: UseConsecutiveOfferActionsOptions) {
  const fallbackToExistingPurchaseOrCompletion = React.useCallback((hidePaymentSelection: boolean) => {
    setConsecutiveOffer(null)
    setShowConsecutiveOverlay(false)
    if (hidePaymentSelection) setShowConsecutivePaymentSelection(false)
    if (bootstrap) {
      openExistingPurchaseFlow({
        courseSlug: bootstrap.context.courseSlug,
        date: bootstrap.context.date,
        time: bootstrap.context.time,
      })
      return
    }
    void handleStationCompletion()
  }, [bootstrap, handleStationCompletion, openExistingPurchaseFlow, setConsecutiveOffer, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  const handleConsecutiveAccept = React.useCallback(async () => {
    if (!consecutiveOffer) return

    const isPackage = hasUsablePackageForCurrentClass
    const priceCents = isPackage
      ? consecutiveOffer.packageHolderConsecutiveCents
      : consecutiveOffer.dropInConsecutiveCents

    if (isPackage) {
      const action = resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        priceCents: priceCents ?? null,
      })

      if (action === "pre-checkin-then-payment-selection") {
        setConsecutiveProcessing(true)
        setConsecutiveProcessingAction("accept")
        setConsecutiveError(null)
        const checkInResult = await performPackageCheckInApi()
        if (!checkInResult) {
          setConsecutiveError("Unable to check in with package.")
          setConsecutiveProcessing(false)
          setConsecutiveProcessingAction(null)
          return
        }
        setPackageCheckInResult(checkInResult)
        setAwaitingConsecutivePaymentSelection(true)
        setShowConsecutiveOverlay(false)
        setConsecutiveProcessing(false)
        setConsecutiveProcessingAction(null)
        return
      }

      if (action === "show-payment-selection") {
        setConsecutiveError(null)
        setShowConsecutivePaymentSelection(true)
        return
      }

      setConsecutiveProcessing(true)
      setConsecutiveProcessingAction("accept")
      setConsecutiveError(null)
      try {
        const token = await getToken({ skipCache: true })
        const body: Record<string, unknown> = {
          courseSlug: consecutiveOffer.linkedCourseSlug,
          date: activeDate,
          time: consecutiveOffer.linkedCourseTime ?? activeTime,
          durationMinutes,
          flowContext: photoFlowContext,
          consecutiveAddOn: true,
          linkedFromCourseSlug: currentCheckInCourseSlug,
          ...(packageCheckInResult?.attendanceId ? { linkedFromAttendanceId: packageCheckInResult.attendanceId } : {}),
          ...(priceCents != null ? { consecutivePriceCents: priceCents } : {}),
          ...(!hasActiveClerkSession && kioskPinSessionToken
            ? { kioskSessionToken: kioskPinSessionToken }
            : {}),
        }

        const { res, data } = await requestPackageCheckIn({ token, payload: body })
        if (!res.ok) {
          setConsecutiveError(typeof data?.error === "string" ? data.error : "Unable to add consecutive class.")
          return
        }

        setConsecutiveOffer(null)
        setConsecutiveSuccess({ courseTitle: consecutiveOffer.linkedCourseTitle })
      } catch {
        setConsecutiveError("Unable to add consecutive class.")
      } finally {
        setConsecutiveProcessing(false)
        setConsecutiveProcessingAction(null)
      }
      return
    }

    setConsecutiveProcessing(true)
    setConsecutiveProcessingAction("accept")
    setConsecutiveError(null)

    try {
      const token = await getToken({ skipCache: true })
      const body: Record<string, unknown> = {
        courseSlug: consecutiveOffer.linkedCourseSlug,
        date: activeDate,
        time: consecutiveOffer.linkedCourseTime ?? activeTime,
        durationMinutes,
        flowContext: photoFlowContext,
        consecutiveDiscountApplied: true,
        linkedFromCourseSlug: currentCheckInCourseSlug,
        ...(priceCents != null ? { consecutivePriceCents: priceCents } : {}),
        ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
      }

      const { res, data } = await requestDropInCheckIn({ token, payload: body })
      if (!res.ok) {
        setConsecutiveError(typeof data?.error === "string" ? data.error : "Unable to add consecutive class.")
        return
      }

      setConsecutiveOffer(null)
      setConsecutiveSuccess({ courseTitle: consecutiveOffer.linkedCourseTitle })
    } catch {
      setConsecutiveError("Unable to add consecutive class.")
    } finally {
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
    }
  }, [activeDate, activeTime, consecutiveOffer, currentCheckInCourseSlug, durationMinutes, getToken, hasActiveClerkSession, hasUsablePackageForCurrentClass, kioskPinSessionToken, packageCheckInResult, performPackageCheckInApi, photoFlowContext, requestDropInCheckIn, requestPackageCheckIn, setAwaitingConsecutivePaymentSelection, setConsecutiveError, setConsecutiveOffer, setConsecutiveProcessing, setConsecutiveProcessingAction, setConsecutiveSuccess, setPackageCheckInResult, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  const handleConsecutiveDecline = React.useCallback(async () => {
    if (!hasUsablePackageForCurrentClass) {
      fallbackToExistingPurchaseOrCompletion(false)
      return
    }

    const declineAction = resolvePackageConsecutiveDeclineAction({
      hasPackageCheckInResult: Boolean(packageCheckInResult),
    })

    if (declineAction === "pre-checkin") {
      setConsecutiveProcessing(true)
      setConsecutiveProcessingAction("decline")
      const checkInResult = await performPackageCheckInApi()
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
      if (!checkInResult) {
        setConsecutiveError("Unable to check in with package.")
        return
      }
      setPackageCheckInResult(checkInResult)
      setConsecutiveOffer(null)
      setShowConsecutiveOverlay(false)
      return
    }

    setConsecutiveOffer(null)
    setShowConsecutiveOverlay(false)
    void handleStationCompletion()
  }, [fallbackToExistingPurchaseOrCompletion, handleStationCompletion, hasUsablePackageForCurrentClass, packageCheckInResult, performPackageCheckInApi, setConsecutiveError, setConsecutiveOffer, setConsecutiveProcessing, setConsecutiveProcessingAction, setPackageCheckInResult, setShowConsecutiveOverlay])

  return { handleConsecutiveAccept, handleConsecutiveDecline }
}
