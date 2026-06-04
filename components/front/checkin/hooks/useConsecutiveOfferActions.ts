import React from "react"

import {
  resolveConsecutivePaymentSuccessAction,
  resolvePackageConsecutiveAcceptAction,
  resolvePackageConsecutiveDeclineAction,
} from "@/lib/checkin/existing-customer-flow"
import {
  requestCheckoutSessionApi,
  requestDropInCheckInApi,
  requestPackageCheckInApi,
} from "@/lib/checkin/checkin-qr-api"
import {
  createEmptyKioskQrCheckoutState,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { CourseData } from "@/constants/courses"

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
  sourceCourses: CourseData[]
  performPackageCheckInApi: () => Promise<PackageCheckInResult | null>
  openExistingPurchaseFlow: (context: { courseSlug: string; date: string; time: string }) => void
  handleStationCompletion: () => void | Promise<void>
  hasUsablePackageForCurrentClass: boolean
  isKioskTerminalFlow: boolean
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  setConsecutiveError: (value: string | null) => void
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  setConsecutiveProcessing: (value: boolean) => void
  setConsecutiveProcessingAction: (value: "accept" | "decline" | "cash" | "card" | null) => void
  setConsecutiveSuccess: (value: { courseTitle: string } | null) => void
  setPackageCheckInResult: (value: PackageCheckInResult | null) => void
  setConsecutiveQrCheckout: (value: KioskQrCheckoutState) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  setShowDuplicatePurchasePopup: (value: boolean) => void
  refreshConsecutiveOffer: () => void
  requestPackageCheckIn?: typeof requestPackageCheckInApi
  requestDropInCheckIn?: typeof requestDropInCheckInApi
  requestCheckoutSession?: typeof requestCheckoutSessionApi
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
  sourceCourses,
  performPackageCheckInApi,
  openExistingPurchaseFlow,
  handleStationCompletion,
  hasUsablePackageForCurrentClass,
  isKioskTerminalFlow,
  setAwaitingConsecutivePaymentSelection,
  setConsecutiveError,
  setConsecutiveOffer,
  setConsecutiveProcessing,
  setConsecutiveProcessingAction,
  setConsecutiveSuccess,
  setPackageCheckInResult,
  setConsecutiveQrCheckout,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  setShowDuplicatePurchasePopup,
  refreshConsecutiveOffer,
  requestPackageCheckIn = requestPackageCheckInApi,
  requestDropInCheckIn = requestDropInCheckInApi,
  requestCheckoutSession = requestCheckoutSessionApi,
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

  const handleConsecutivePayCash = React.useCallback(async () => {
    if (!consecutiveOffer) return
    if (!hasUsablePackageForCurrentClass) {
      fallbackToExistingPurchaseOrCompletion(true)
      return
    }
    setConsecutiveProcessing(true)
    setConsecutiveProcessingAction("cash")
    setConsecutiveError(null)
    try {
      const token = await getToken({ skipCache: true })
      const isPackage = hasUsablePackageForCurrentClass

      const priceCents = isPackage
        ? consecutiveOffer.packageHolderConsecutiveCents
        : consecutiveOffer.dropInConsecutiveCents

      const body: Record<string, unknown> = {
        courseSlug: consecutiveOffer.linkedCourseSlug,
        date: activeDate,
        time: consecutiveOffer.linkedCourseTime ?? activeTime,
        durationMinutes,
        flowContext: photoFlowContext,
        paymentMethod: "cash",
        ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
      }

      if (isPackage) {
        body.consecutiveAddOn = true
        body.consecutiveCashPayment = true
        body.linkedFromCourseSlug = currentCheckInCourseSlug
        if (packageCheckInResult?.attendanceId) body.linkedFromAttendanceId = packageCheckInResult.attendanceId
        if (priceCents != null) body.consecutivePriceCents = priceCents
      } else {
        body.consecutiveDiscountApplied = true
        body.consecutiveCashPayment = true
        body.linkedFromCourseSlug = currentCheckInCourseSlug
        if (priceCents != null) body.consecutivePriceCents = priceCents
      }

      const { res, data } = isPackage
        ? await requestPackageCheckIn({ token, payload: body })
        : await requestDropInCheckIn({ token, payload: body })
      if (!res.ok) {
        setConsecutiveError(typeof data?.error === "string" ? data.error : "Unable to process cash payment.")
        return
      }

      setShowConsecutivePaymentSelection(false)
      setConsecutiveOffer(null)

      const successAction = resolveConsecutivePaymentSuccessAction({
        isKioskTerminalFlow,
      })
      if (successAction === "complete-station") {
        void handleStationCompletion()
        return
      }

      setConsecutiveSuccess({ courseTitle: consecutiveOffer.linkedCourseTitle })
    } catch {
      setConsecutiveError("Unable to process cash payment.")
    } finally {
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
    }
  }, [activeDate, activeTime, consecutiveOffer, currentCheckInCourseSlug, durationMinutes, fallbackToExistingPurchaseOrCompletion, getToken, handleStationCompletion, hasActiveClerkSession, hasUsablePackageForCurrentClass, isKioskTerminalFlow, kioskPinSessionToken, packageCheckInResult, photoFlowContext, requestDropInCheckIn, requestPackageCheckIn, setConsecutiveError, setConsecutiveOffer, setConsecutiveProcessing, setConsecutiveProcessingAction, setConsecutiveSuccess, setShowConsecutivePaymentSelection])

  const handleConsecutivePayCard = React.useCallback(async () => {
    if (!consecutiveOffer) return
    if (!hasUsablePackageForCurrentClass) {
      fallbackToExistingPurchaseOrCompletion(true)
      return
    }
    setConsecutiveError(null)
    setConsecutiveProcessing(true)
    setConsecutiveProcessingAction("card")
    setShowDuplicatePurchasePopup(false)
    setShowConsecutivePaymentSelection(false)

    const linkedCourse = sourceCourses.find((course) => course.slug === consecutiveOffer.linkedCourseSlug) || null
    const linkedCourseServiceId =
      linkedCourse?.enrollment.services.find((service) => service.id !== "new-student")?.id ||
      linkedCourse?.enrollment.services[0]?.id ||
      ""
    if (!linkedCourseServiceId) {
      setConsecutiveQrCheckout({
        ...createEmptyKioskQrCheckoutState(),
        phase: "error",
        error: "Unable to find a valid service for the next class.",
      })
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
      return
    }

    const priceCents = hasUsablePackageForCurrentClass
      ? consecutiveOffer.packageHolderConsecutiveCents
      : consecutiveOffer.dropInConsecutiveCents

    if (priceCents == null || priceCents <= 0) {
      setConsecutiveError("Unable to determine price for card payment.")
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
      return
    }

    setConsecutiveQrCheckout({
      ...createEmptyKioskQrCheckoutState(),
      phase: "creating",
    })

    try {
      const { res, data } = await requestCheckoutSession({
        payload: {
          courseSlug: consecutiveOffer.linkedCourseSlug,
          courseTitle: consecutiveOffer.linkedCourseTitle,
          amount: priceCents,
          currency: "usd",
          date: activeDate,
          time: consecutiveOffer.linkedCourseTime ?? activeTime,
          serviceId: linkedCourseServiceId,
          firstName: bootstrap?.customer?.firstName,
          lastName: bootstrap?.customer?.lastName,
          email: bootstrap?.customer?.email,
          phone: bootstrap?.customer?.phone,
          participants: 1,
          photoContext: "kiosk_terminal",
          ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
          consecutiveAddOnOnly: hasUsablePackageForCurrentClass,
          linkedFromCourseSlug: currentCheckInCourseSlug,
          ...(packageCheckInResult?.attendanceId ? { linkedFromAttendanceId: packageCheckInResult.attendanceId } : {}),
          consecutivePriceCents: priceCents,
          consecutiveLinkedCourseSlug: consecutiveOffer.linkedCourseSlug,
          consecutiveCourseTitle: consecutiveOffer.linkedCourseTitle,
          consecutiveLinkedCourseTime: consecutiveOffer.linkedCourseTime ?? activeTime,
        },
      })

      if (!res.ok || typeof data?.url !== "string" || typeof data?.sessionId !== "string") {
        const message = typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "Error starting QR checkout."
        setConsecutiveQrCheckout({
          ...createEmptyKioskQrCheckoutState(),
          phase: "error",
          error: message,
        })
        setConsecutiveProcessing(false)
        setConsecutiveProcessingAction(null)
        return
      }

      setConsecutiveQrCheckout({
        phase: "qr_ready",
        sessionId: data.sessionId,
        url: data.url,
        expiresAt: typeof data?.expiresAt === "string" ? data.expiresAt : null,
        awaitingWebhook: false,
        purchaseId: null,
        paymentStatus: null,
        error: null,
      })
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
    } catch {
      setConsecutiveQrCheckout({
        ...createEmptyKioskQrCheckoutState(),
        phase: "error",
        error: "We couldn't start the QR payment. Please try again.",
      })
      setConsecutiveProcessing(false)
      setConsecutiveProcessingAction(null)
    }
  }, [activeDate, activeTime, bootstrap, consecutiveOffer, currentCheckInCourseSlug, fallbackToExistingPurchaseOrCompletion, hasActiveClerkSession, hasUsablePackageForCurrentClass, kioskPinSessionToken, packageCheckInResult, requestCheckoutSession, setConsecutiveError, setConsecutiveProcessing, setConsecutiveProcessingAction, setConsecutiveQrCheckout, setShowConsecutivePaymentSelection, setShowDuplicatePurchasePopup, sourceCourses])

  const handleConsecutiveQrCancel = React.useCallback(() => {
    setConsecutiveQrCheckout(createEmptyKioskQrCheckoutState())
    setShowConsecutivePaymentSelection(true)
  }, [setConsecutiveQrCheckout, setShowConsecutivePaymentSelection])

  const handleConsecutiveQrComplete = React.useCallback(() => {
    setConsecutiveQrCheckout(createEmptyKioskQrCheckoutState())
    setConsecutiveOffer(null)
    setShowConsecutivePaymentSelection(false)
    setShowConsecutiveOverlay(false)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveOffer, setConsecutiveQrCheckout, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  return {
    handleConsecutiveAccept,
    handleConsecutiveDecline,
    handleConsecutivePayCash,
    handleConsecutivePayCard,
    handleConsecutiveQrCancel,
    handleConsecutiveQrComplete,
  }
}
