import React from "react"

import type { BootstrapResponse, EntryMode } from "@/components/front/checkin/checkin.types"

type CheckInContextOverride = { courseSlug: string; date: string; time: string; durationMinutes?: number }
type SelectedCourseLike = { slug: string } | null
type LatePaymentRecommendation = CheckInContextOverride | null

type UseEntryModeRouterOptions = {
  activeDate: string
  activeTime: string
  activeSessionId: string | null
  bootstrap: BootstrapResponse | null
  checkConsecutiveOfferAfterCheckIn: () => Promise<boolean>
  clearSuppressedClerkSessionId: () => void
  clerkSignOut: (options: { redirectUrl: string; sessionId?: string }) => void | Promise<void>
  consecutiveOfferSettled: boolean
  contextIsValid: boolean
  displayLatePaymentQrLink: string | null
  durationMinutes?: number
  effectiveCheckInWindowOpen: boolean
  forceRedirectUrl: string
  handlePackageCheckIn: () => void | Promise<void>
  handleStationCompletion: () => void | Promise<void>
  hasActiveClerkSession: boolean
  isKioskTerminalFlow: boolean
  latePaymentRecommendation: LatePaymentRecommendation
  loadBootstrap: (contextOverride?: Record<string, unknown>) => void | Promise<void>
  mode: EntryMode
  openExistingPurchaseFlow: (context: CheckInContextOverride) => void
  pendingNewBooking: boolean
  processingPackageCheckIn: boolean
  refreshConsecutiveOffer: () => void
  registerKioskClerkSession: (sessionId: string) => void
  reloadCatalogCourses: () => void | Promise<void>
  resetKioskPinFlow: () => void
  selectedCourse: SelectedCourseLike
  setBootstrap: React.Dispatch<React.SetStateAction<BootstrapResponse | null>>
  setConsecutiveOfferSettled: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setLatePaymentEntryOverride: React.Dispatch<React.SetStateAction<CheckInContextOverride | null>>
  setMode: React.Dispatch<React.SetStateAction<EntryMode>>
  setNewBookingOverride: React.Dispatch<React.SetStateAction<CheckInContextOverride | null>>
  setOpenNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  setPendingLoginPhone: React.Dispatch<React.SetStateAction<string>>
  setPendingNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  setReturnedFromNewStudentFlow: React.Dispatch<React.SetStateAction<boolean>>
  setShowPhoneSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
}

const QR_MISSING_CONTEXT_ERROR = "We couldn't open the purchase because QR data is missing."
const CLOSED_CHECK_IN_WINDOW_ERROR = "The check-in window for this class is closed."

export function useEntryModeRouter({
  activeDate,
  activeTime,
  activeSessionId,
  bootstrap,
  checkConsecutiveOfferAfterCheckIn,
  clearSuppressedClerkSessionId,
  clerkSignOut,
  consecutiveOfferSettled,
  contextIsValid,
  displayLatePaymentQrLink,
  durationMinutes,
  effectiveCheckInWindowOpen,
  forceRedirectUrl,
  handlePackageCheckIn,
  handleStationCompletion,
  hasActiveClerkSession,
  isKioskTerminalFlow,
  latePaymentRecommendation,
  loadBootstrap,
  mode,
  openExistingPurchaseFlow,
  pendingNewBooking,
  processingPackageCheckIn,
  refreshConsecutiveOffer,
  registerKioskClerkSession,
  reloadCatalogCourses,
  resetKioskPinFlow,
  selectedCourse,
  setBootstrap,
  setConsecutiveOfferSettled,
  setError,
  setLatePaymentEntryOverride,
  setMode,
  setNewBookingOverride,
  setOpenNewBooking,
  setPendingLoginPhone,
  setPendingNewBooking,
  setReturnedFromNewStudentFlow,
  setShowPhoneSignIn,
  setSuccess,
}: UseEntryModeRouterOptions) {
  const handleExistingClick = React.useCallback((contextOverride?: CheckInContextOverride) => {
    void reloadCatalogCourses()
    setMode("existing")
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    resetKioskPinFlow()
    if (contextOverride) {
      setLatePaymentEntryOverride(contextOverride)
    }
    const canUseContext = contextOverride || (selectedCourse && contextIsValid)
    if (!canUseContext) {
      setError(QR_MISSING_CONTEXT_ERROR)
      return
    }
    if (isKioskTerminalFlow && !hasActiveClerkSession) return
    if (!hasActiveClerkSession) {
      setShowPhoneSignIn(true)
      return
    }
    void loadBootstrap(contextOverride ? {
      ...contextOverride,
      durationMinutes: contextOverride.durationMinutes ?? durationMinutes ?? 60,
      linkedFromCourseSlug: contextOverride.courseSlug,
    } : undefined)
  }, [contextIsValid, durationMinutes, hasActiveClerkSession, isKioskTerminalFlow, loadBootstrap, reloadCatalogCourses, resetKioskPinFlow, selectedCourse, setBootstrap, setError, setLatePaymentEntryOverride, setMode, setShowPhoneSignIn, setSuccess])

  const handleNewClick = React.useCallback((contextOverride?: CheckInContextOverride) => {
    void reloadCatalogCourses()
    setMode("new")
    setError(null)
    setSuccess(null)
    const bookingContext = contextOverride ?? (selectedCourse && contextIsValid
      ? { courseSlug: selectedCourse.slug, date: activeDate, time: activeTime }
      : null)
    if (!bookingContext) {
      setError(QR_MISSING_CONTEXT_ERROR)
      return
    }
    setNewBookingOverride(bookingContext)
    if (contextOverride) {
      setConsecutiveOfferSettled(false)
    }
    setOpenNewBooking(true)
  }, [activeDate, activeTime, contextIsValid, reloadCatalogCourses, selectedCourse, setConsecutiveOfferSettled, setError, setMode, setNewBookingOverride, setOpenNewBooking, setSuccess])

  React.useEffect(() => {
    if (pendingNewBooking && consecutiveOfferSettled) {
      setOpenNewBooking(true)
      setPendingNewBooking(false)
    }
  }, [consecutiveOfferSettled, pendingNewBooking, setOpenNewBooking, setPendingNewBooking])

  const handleLatePaymentTablet = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    setMode("idle")
  }, [latePaymentRecommendation, setBootstrap, setError, setMode, setSuccess])

  const handleLatePaymentPhone = React.useCallback(() => {
    if (!displayLatePaymentQrLink || typeof window === "undefined") return
    window.open(displayLatePaymentQrLink, "_blank", "noopener,noreferrer")
  }, [displayLatePaymentQrLink])

  const handleLatePaymentExisting = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    void reloadCatalogCourses()
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    resetKioskPinFlow()
    setLatePaymentEntryOverride(latePaymentRecommendation)
    setMode("existing")
  }, [latePaymentRecommendation, reloadCatalogCourses, resetKioskPinFlow, setBootstrap, setError, setLatePaymentEntryOverride, setMode, setSuccess])

  const handleLatePaymentNew = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    void reloadCatalogCourses()
    setError(null)
    setSuccess(null)
    setMode("new")
    setNewBookingOverride(latePaymentRecommendation)
    setOpenNewBooking(true)
  }, [latePaymentRecommendation, reloadCatalogCourses, setError, setMode, setNewBookingOverride, setOpenNewBooking, setSuccess])

  const handlePhoneSignInSuccess = React.useCallback(async () => {
    clearSuppressedClerkSessionId()
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    setBootstrap(null)
  }, [clearSuppressedClerkSessionId, setBootstrap, setError, setPendingLoginPhone, setShowPhoneSignIn, setSuccess])

  const handlePhoneSignInSession = React.useCallback(async (sessionId: string) => {
    registerKioskClerkSession(sessionId)
  }, [registerKioskClerkSession])

  const handleSwitchAccount = React.useCallback(() => {
    void clerkSignOut({ redirectUrl: forceRedirectUrl, ...(activeSessionId ? { sessionId: activeSessionId } : {}) })
  }, [activeSessionId, clerkSignOut, forceRedirectUrl])

  const handleExistingUserDetected = React.useCallback(() => {
    setOpenNewBooking(false)
    setNewBookingOverride(null)
    setPendingLoginPhone("")
    setShowPhoneSignIn(false)
    setReturnedFromNewStudentFlow(true)
    setMode("existing")
  }, [setMode, setNewBookingOverride, setOpenNewBooking, setPendingLoginPhone, setReturnedFromNewStudentFlow, setShowPhoneSignIn])

  React.useEffect(() => {
    if (mode !== "existing") setReturnedFromNewStudentFlow(false)
  }, [mode, setReturnedFromNewStudentFlow])

  const handleNewUserPostPurchase = React.useCallback(async () => {
    if (isKioskTerminalFlow) {
      setOpenNewBooking(false)
      setNewBookingOverride(null)
      const hasOffer = await checkConsecutiveOfferAfterCheckIn()
      if (!hasOffer) {
        refreshConsecutiveOffer()
        void handleStationCompletion()
      }
      return
    }
    void handleStationCompletion()
  }, [checkConsecutiveOfferAfterCheckIn, handleStationCompletion, isKioskTerminalFlow, refreshConsecutiveOffer, setNewBookingOverride, setOpenNewBooking])

  const handleBootstrapAction = React.useCallback(() => {
    if (processingPackageCheckIn) return
    if (!effectiveCheckInWindowOpen) {
      setError(CLOSED_CHECK_IN_WINDOW_ERROR)
      return
    }
    if (bootstrap?.package) {
      void handlePackageCheckIn()
      return
    }
    openExistingPurchaseFlow({
      courseSlug: bootstrap!.context.courseSlug,
      date: bootstrap!.context.date,
      time: bootstrap!.context.time,
      durationMinutes: bootstrap!.context.durationMinutes,
    })
  }, [bootstrap, effectiveCheckInWindowOpen, handlePackageCheckIn, openExistingPurchaseFlow, processingPackageCheckIn, setError])

  const handleBackToCurrentClass = React.useCallback(() => {
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    setLatePaymentEntryOverride(null)
    setMode("idle")
  }, [setBootstrap, setError, setLatePaymentEntryOverride, setMode, setSuccess])

  return {
    handleBackToCurrentClass,
    handleBootstrapAction,
    handleExistingClick,
    handleExistingUserDetected,
    handleLatePaymentExisting,
    handleLatePaymentNew,
    handleLatePaymentPhone,
    handleLatePaymentTablet,
    handleNewClick,
    handleNewUserPostPurchase,
    handlePhoneSignInSession,
    handlePhoneSignInSuccess,
    handleSwitchAccount,
  }
}
