"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { demoCourses } from "@/constants/courses"
import EnrollModal from "@/components/front/courses/EnrollModal"
import { toE164Phone } from "@/components/front/courses/utils/phone"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import {
  getExistingCustomerInitialStep,
  shouldSurfaceClosedWindowPackageError,
  shouldAutoOpenExistingPurchase,
  shouldAutoTriggerPackageCheckIn,
  resolveDuplicatePurchaseDoneAction,
  shouldShowConsecutiveOfferGate,
  shouldPreserveOfferOnBootstrapClear,
  resolveConsecutivePaymentSuccessAction,
  shouldAutoPromoteExistingMode,
} from "@/lib/checkin/existing-customer-flow"
import {
  pickEnrollPrefill,
} from "@/lib/checkin/package-offer-integration"
// KioskPackageOfferScreen removed - packages step is now in EnrollModal
import { useKioskCustomerSession } from "@/components/front/checkin/useKioskCustomerSession"
import { useKioskFlowCompletion } from "@/components/front/checkin/useKioskFlowCompletion"
import { useKioskPinFlow } from "@/components/front/checkin/useKioskPinFlow"
import {
  KioskResolvingOverlay,
  KioskPackageSuccessOverlay,
  KioskDuplicatePurchaseOverlay,
  ConsecutiveClassOffer,
  ConsecutiveOfferSuccess,
  ConsecutiveOfferError,
  ContextWarning,
  QrPromptText,
  EntrySelectionButtons,
  LatePaymentPanel,
  PhoneSignInModal,
  CheckInHeader,
  CourseCardPanel,
  InlineFeedback,
  SignedInBootstrapPanel,
  KioskPinModal,
} from "@/components/front/checkin"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import {
  createEmptyKioskQrCheckoutState,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import { useKioskQrCheckoutPoller } from "@/components/front/checkin/hooks/useKioskQrCheckoutPoller"
import { useCheckInPackageFlow } from "@/components/front/checkin/hooks/useCheckInPackageFlow"
import { useCheckInBootstrap } from "@/components/front/checkin/hooks/useCheckInBootstrap"
import { useConsecutiveOfferLookup } from "@/components/front/checkin/hooks/useConsecutiveOfferLookup"
import { useConsecutiveOfferState } from "@/components/front/checkin/hooks/useConsecutiveOfferState"
import { useConsecutiveOfferActions } from "@/components/front/checkin/hooks/useConsecutiveOfferActions"
import {
  toEsDateTime,
  parseDuration,
  TRANSIENT_MESSAGE_TIMEOUT_MS,
} from "@/lib/checkin/checkin-helpers"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import { resolveCheckInActiveContext, resolveCheckInBootstrapContextPayload } from "@/lib/checkin/checkin-bootstrap-context"
import { hasTerminalSensitiveCustomerState } from "@/lib/checkin/terminal-sensitive-state"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import {
  requestCheckoutSessionApi,
  requestDropInCheckInApi,
  requestPackageCheckInApi,
} from "@/lib/checkin/checkin-qr-api"
import type { EntryMode, BootstrapResponse, CheckInQrClientProps, PackageOfferContext } from "@/components/front/checkin/checkin.types"

export default function CheckInQrClient({
  forcedDeviceMode,
  forcedCourseSlug = "",
  selectedCourseSlug,
  hideQrPanel = false,
  shellVariant = "qr",
  terminalName,
  terminalLocation,
  qrPathOverride,
  simulatedNowTick,
  onFlowActiveChange,
}: CheckInQrClientProps & { selectedCourseSlug?: string }) {
  const { courses: catalogCourses, reload: reloadCatalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, sessionId: activeSessionId } = useAuth()
  const clerk = useClerk()
  const [internalNowTick, setInternalNowTick] = React.useState<Date>(() => new Date())
  const nowTick = simulatedNowTick ?? internalNowTick
  const [origin, setOrigin] = React.useState("")
  const [isCompactViewport, setIsCompactViewport] = React.useState(false)
  const durationMinutes = parseDuration(searchParams.get("durationMinutes"))

  // ─── State ──────────────────────────────────────────────────
  const [mode, setMode] = React.useState<EntryMode>("idle")
  const [openNewBooking, setOpenNewBooking] = React.useState(false)
  const [newBookingOverride, setNewBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [latePaymentEntryOverride, setLatePaymentEntryOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [showPhoneSignIn, setShowPhoneSignIn] = React.useState(false)
  const [pendingLoginPhone, setPendingLoginPhone] = React.useState("")
  const [existingRegularBookingOverride, setExistingRegularBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [existingRegularBookingKey, setExistingRegularBookingKey] = React.useState(0)
  // When the user accepts a consecutive offer pre-check-in with a positive
  // price, we first show the package success overlay (credit consumed,
  // remaining credits) and wait for the operator/student to press "Done"
  // before opening the Cash/Card payment selection for class B. This flag
  // tells the Done handler to advance to payment selection instead of
  // resetting the station.
  const [awaitingConsecutivePaymentSelection, setAwaitingConsecutivePaymentSelection] = React.useState(false)
  const [paymentsModalReady, setPaymentsModalReady] = React.useState(false)
  const [processingPackageCheckIn, setProcessingPackageCheckIn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [showDuplicatePurchasePopup, setShowDuplicatePurchasePopup] = React.useState(false)
  const [packageOfferContext, setPackageOfferContext] = React.useState<PackageOfferContext>(null)
  const [packageOfferSelectedId, setPackageOfferSelectedId] = React.useState<string | null>(null)
  const setBootstrapRef = React.useRef<React.Dispatch<React.SetStateAction<BootstrapResponse | null>>>(() => {})
  const setBootstrapFromRef = React.useCallback<React.Dispatch<React.SetStateAction<BootstrapResponse | null>>>(
    (value) => setBootstrapRef.current(value),
    []
  )
  const handleStationCompletionRef = React.useRef<() => void | Promise<void>>(() => {})
  const checkConsecutiveOfferAfterCheckInRef = React.useRef<() => Promise<boolean>>(async () => false)

  // ─── Consecutive card QR checkout state ─────────────────────
  const [consecutiveQrCheckout, setConsecutiveQrCheckout] = React.useState<KioskQrCheckoutState>(
    createEmptyKioskQrCheckoutState()
  )

  const preDisplayActiveContext = React.useMemo(
    () => resolveCheckInActiveContext({
      sourceCourses,
      shellVariant,
      searchParams,
      forcedCourseSlug,
      selectedCourseSlug,
      nowTick,
    }),
    [forcedCourseSlug, nowTick, searchParams, selectedCourseSlug, shellVariant, sourceCourses]
  )
  const contextPayload = React.useMemo(
    () => resolveCheckInBootstrapContextPayload({
      activeCourseSlug: preDisplayActiveContext.activeCourseSlug,
      activeDate: preDisplayActiveContext.activeDate,
      activeTime: preDisplayActiveContext.activeTime,
      durationMinutes,
      latePaymentEntryOverride,
    }),
    [durationMinutes, latePaymentEntryOverride, preDisplayActiveContext.activeCourseSlug, preDisplayActiveContext.activeDate, preDisplayActiveContext.activeTime]
  )

  // ─── Derived error ──────────────────────────────────────────
  const visibleError = React.useMemo(() => {
    if (!error) return null
    const normalized = error.trim().toLowerCase()
    if (
      normalized.includes("we couldn't prepare the fast flow") ||
      normalized.includes("we couldn't load the fast flow")
    ) {
      return null
    }
    return error
  }, [error])

  const isQrEntry = React.useMemo(() => {
    const qrView = (searchParams.get("fromQr") || searchParams.get("scan") || "").trim().toLowerCase()
    return qrView === "1" || qrView === "true"
  }, [searchParams])
  const photoFlowContext = React.useMemo(
    () => resolvePhotoFlowContext({ shellVariant, isQrEntry }),
    [isQrEntry, shellVariant]
  )
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"

  const {
    consecutiveOffer,
    setConsecutiveOffer,
    consecutiveOfferSettled,
    setConsecutiveOfferSettled,
    showConsecutiveOverlay,
    setShowConsecutiveOverlay,
    showConsecutivePaymentSelection,
    setShowConsecutivePaymentSelection,
    consecutiveProcessing,
    setConsecutiveProcessing,
    consecutiveProcessingAction,
    setConsecutiveProcessingAction,
    consecutiveSuccess,
    setConsecutiveSuccess,
    consecutiveError,
    setConsecutiveError,
    pendingNewBooking,
    setPendingNewBooking,
    refreshConsecutiveOffer,
  } = useConsecutiveOfferState({
    isKioskTerminalFlow,
    activeCourseSlug: preDisplayActiveContext.activeCourseSlug,
    activeTime: preDisplayActiveContext.activeTime,
  })

  // ─── Kiosk hooks ────────────────────────────────────────────
  const {
    activePinField,
    canIdentify,
    canRotate,
    confirmActiveSlot,
    confirmRevealedIndex,
    entryActiveSlot,
    entryRevealedIndex,
    handleKioskPinIdentify,
    handleKioskPinRotate,
    handlePinBackspace,
    handlePinClear,
    handlePinDigitInput,
    hasKioskPinSession,
    kioskPin,
    kioskPinAttemptsRemaining,
    kioskPinBlockedUntil,
    kioskPinThrottleSeverity,
    kioskPinConfirm,
    kioskPinLoading,
    kioskPinNext,
    kioskPinPanelCopy,
    kioskPinRotating,
    kioskPinRotationRequired,
    kioskPinSessionToken,
    nextActiveSlot,
    nextRevealedIndex,
    resetKioskPinFlow,
    setKioskPin,
    setKioskPinAttemptsRemaining,
    setKioskPinBlockedUntil,
    setKioskPinConfirm,
    setKioskPinNext,
    setKioskPinRotationMode,
    setKioskPinRotationRequired,
    setKioskPinSessionToken,
  } = useKioskPinFlow<BootstrapResponse>({
    isKioskTerminalFlow,
    setBootstrap: setBootstrapFromRef,
    setError,
    setSuccess,
  })

  const {
    clearSuppressedClerkSessionId,
    hasActiveClerkSession,
    registerKioskClerkSession,
    resetKioskCustomerSession,
  } = useKioskCustomerSession({
    activeSessionId,
    isKioskTerminalFlow,
    isSignedIn,
    user,
  })

  const {
    bootstrap,
    loadingBootstrap,
    setBootstrap,
    loadBootstrap,
  } = useCheckInBootstrap({
    contextIsValid: preDisplayActiveContext.contextIsValid,
    contextPayload,
    getToken,
    hasActiveClerkSession,
    kioskPinRotationRequired,
    kioskPinSessionToken,
    photoFlowContext,
    setError,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
  })
  setBootstrapRef.current = setBootstrap

  // ─── Derived display data (extracted hook) ──────────────────
  const display = useCheckInDisplayData({
    sourceCourses,
    shellVariant,
    hideQrPanel,
    qrPathOverride,
    pathname,
    searchParams,
    forcedDeviceMode,
    forcedCourseSlug,
    selectedCourseSlug,
    nowTick,
    origin,
    isCompactViewport,
    mode,
    hasActiveClerkSession,
    hasKioskPinSession,
    kioskPinRotationRequired,
    loadingBootstrap,
    bootstrap,
    visibleError,
    paymentsModalReady,
    existingRegularBookingOverride,
    openNewBooking,
    processingPackageCheckIn,
    packageOfferContext,
  })

  const {
    forceRedirectUrl,
    entryMode,
    qrCourse,
    latePaymentRecommendation,
    activeCourseSlug,
    activeDate,
    activeTime,
    selectedCourse,
    contextIsValid,
    completionMode,
    showQrPanel,
    showSignedInBootstrapPanel,
    showKioskPinPanel,
    hideEntrySelection,
    showCourseCardPanel,
    showLatePaymentOffer,
    showContextWarning,
    showKioskResolvingOverlay,
    welcomeLabel,
    shellEyebrow,
    mainSpacingClass,
    checkInDisplayDate,
    checkInDisplayTime,
    effectiveCheckInWindowOpen,
    breadcrumbItems,
    quickCheckoutDetails,
    checkInDisplayCourse,
    checkInCardImage,
    checkInCardTeacher,
    checkInCardDuration,
    checkInCardStudents,
    checkInCardBadge,
    checkInCardCategory,
    checkInCardDescription,
    checkInQrImage,
    bootstrapCourseImage,
    bootstrapCardCategory,
    bootstrapCardBadge,
    bootstrapCardDuration,
    bootstrapCardStudents,
    bootstrapCardTeacher,
    bootstrapCardDescription,
    bootstrapContact,
    hasBootstrapPrefilledContact,
    isLatePaymentContext,
    latePaymentCourse,
    latePaymentQrImage,
  } = display

  const hasUsablePackageForCurrentClass = Boolean(
    bootstrap?.package &&
      ((bootstrap.package.isUnlimited && bootstrap.package.remainingCredits == null) ||
        (bootstrap.package.remainingCredits ?? 0) > 0)
  )
  const currentCheckInCourseSlug = bootstrap?.context.courseSlug ?? activeCourseSlug
  const checkConsecutiveOfferAfterCheckInFromRef = React.useCallback(
    () => checkConsecutiveOfferAfterCheckInRef.current(),
    []
  )
  const handleStationCompletionFromRef = React.useCallback(() => handleStationCompletionRef.current(), [])

  const {
    packageCheckInResult,
    setPackageCheckInResult,
    performPackageCheckInApi,
    handlePackageCheckIn,
    handlePackageSuccessDone,
  } = useCheckInPackageFlow({
    bootstrap,
    getToken,
    hasActiveClerkSession,
    kioskPinSessionToken,
    effectiveCheckInWindowOpen,
    photoFlowContext,
    isKioskTerminalFlow,
    setProcessingPackageCheckIn,
    awaitingConsecutivePaymentSelection,
    setError,
    setSuccess,
    loadBootstrap,
    checkConsecutiveOfferAfterCheckIn: checkConsecutiveOfferAfterCheckInFromRef,
    handleStationCompletion: handleStationCompletionFromRef,
    setAwaitingConsecutivePaymentSelection,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
  })

  // ─── Booking contexts ───────────────────────────────────────
  const newBookingCourse = React.useMemo(
    () => sourceCourses.find((course) => course.slug === (newBookingOverride?.courseSlug || "")) || selectedCourse || qrCourse,
    [newBookingOverride?.courseSlug, qrCourse, selectedCourse, sourceCourses]
  )
  const newBookingContext = React.useMemo(
    () => ({
      date: newBookingOverride?.date || activeDate,
      time: newBookingOverride?.time || activeTime,
      durationMinutes,
    }),
    [activeDate, activeTime, durationMinutes, newBookingOverride?.date, newBookingOverride?.time]
  )
  const existingRegularBookingCourse = React.useMemo(() => {
    const baseCourse =
      sourceCourses.find((course) => course.slug === (existingRegularBookingOverride?.courseSlug || "")) ||
      selectedCourse ||
      qrCourse
    if (!baseCourse) return null
    const regularServices = baseCourse.enrollment.services.filter((item) => item.id !== "new-student")
    if (!regularServices.length) return baseCourse
    return {
      ...baseCourse,
      enrollment: {
        ...baseCourse.enrollment,
        services: regularServices,
      },
    }
  }, [existingRegularBookingOverride?.courseSlug, qrCourse, selectedCourse, sourceCourses])
  const existingRegularBookingContext = React.useMemo(
    () => ({
      date: existingRegularBookingOverride?.date || activeDate,
      time: existingRegularBookingOverride?.time || activeTime,
      durationMinutes,
    }),
    [activeDate, activeTime, durationMinutes, existingRegularBookingOverride?.date, existingRegularBookingOverride?.time]
  )

  const { handleStationCompletion, dismissExistingCustomer: handleExistingCustomerDismiss } = useKioskFlowCompletion({
    isKioskTerminalFlow,
    resetKioskCustomerSession,
    setBootstrap,
    setError,
    setExistingRegularBookingOverride,
    setKioskPin,
    setKioskPinAttemptsRemaining,
    setKioskPinBlockedUntil,
    setKioskPinConfirm,
    setKioskPinNext,
    setKioskPinRotationMode,
    setKioskPinRotationRequired,
    setKioskPinSessionToken,
    setMode,
    setNewBookingOverride,
    setLatePaymentEntryOverride,
    setOpenNewBooking,
    setPaymentsModalReady,
    setPendingLoginPhone,
    setShowPhoneSignIn,
    setSuccess,
    setPackageOfferContext,
    setPackageOfferSelectedId,
    setConsecutiveOffer,
    setConsecutiveOfferSettled,
    refreshConsecutiveOffer,
    setPackageCheckInResult,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setAwaitingConsecutivePaymentSelection,
  })
  handleStationCompletionRef.current = handleStationCompletion

  const openExistingPurchaseFlow = React.useCallback((context: { courseSlug: string; date: string; time: string }) => {
    setError(null)
    setSuccess(null)
    setPaymentsModalReady(false)
    setExistingRegularBookingKey((prev) => prev + 1)
    setExistingRegularBookingOverride(context)
  }, [])

  // ─── Consecutive offer handlers ─────────────────────────────
  const { checkConsecutiveOfferAfterCheckIn } = useConsecutiveOfferLookup({
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
  })
  checkConsecutiveOfferAfterCheckInRef.current = checkConsecutiveOfferAfterCheckIn

  const { handleConsecutiveAccept, handleConsecutiveDecline } = useConsecutiveOfferActions({
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
  })

  const handleConsecutiveSuccessDone = React.useCallback(() => {
    setConsecutiveSuccess(null)
    setShowConsecutiveOverlay(false)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveSuccess, setShowConsecutiveOverlay])

  const handleConsecutiveRetry = React.useCallback(() => {
    setConsecutiveError(null)
    void handleConsecutiveAccept()
  }, [handleConsecutiveAccept, setConsecutiveError])

  const handleConsecutiveErrorDismiss = React.useCallback(() => {
    setConsecutiveError(null)
    setConsecutiveOffer(null)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveError, setConsecutiveOffer])

  // ─── Consecutive payment handlers ───────────────────────────
  const handleConsecutivePayCash = React.useCallback(async () => {
    if (!consecutiveOffer) return
    if (!hasUsablePackageForCurrentClass) {
      setConsecutiveOffer(null)
      setShowConsecutiveOverlay(false)
      setShowConsecutivePaymentSelection(false)
      if (bootstrap) {
        openExistingPurchaseFlow({
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
        })
        return
      }
      void handleStationCompletion()
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
        ? await requestPackageCheckInApi({ token, payload: body })
        : await requestDropInCheckInApi({ token, payload: body })
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
  }, [consecutiveOffer, activeDate, activeTime, durationMinutes, getToken, bootstrap, photoFlowContext, hasActiveClerkSession, kioskPinSessionToken, packageCheckInResult, currentCheckInCourseSlug, handleStationCompletion, isKioskTerminalFlow, openExistingPurchaseFlow, hasUsablePackageForCurrentClass, setConsecutiveError, setConsecutiveOffer, setConsecutiveProcessing, setConsecutiveProcessingAction, setConsecutiveSuccess, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  const handleConsecutivePayCard = React.useCallback(async () => {
    if (!consecutiveOffer) return
    if (!hasUsablePackageForCurrentClass) {
      setConsecutiveOffer(null)
      setShowConsecutiveOverlay(false)
      setShowConsecutivePaymentSelection(false)
      if (bootstrap) {
        openExistingPurchaseFlow({
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
        })
        return
      }
      void handleStationCompletion()
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

    // Start QR checkout flow
    setConsecutiveQrCheckout({
      ...createEmptyKioskQrCheckoutState(),
      phase: "creating",
    })

    try {
      const { res, data } = await requestCheckoutSessionApi({
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
  }, [consecutiveOffer, sourceCourses, bootstrap, activeDate, activeTime, hasActiveClerkSession, kioskPinSessionToken, packageCheckInResult, currentCheckInCourseSlug, hasUsablePackageForCurrentClass, openExistingPurchaseFlow, handleStationCompletion, setConsecutiveError, setConsecutiveOffer, setConsecutiveProcessing, setConsecutiveProcessingAction, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  const handleConsecutiveQrCancel = React.useCallback(() => {
    setConsecutiveQrCheckout(createEmptyKioskQrCheckoutState())
    // Return to payment selection
    setShowConsecutivePaymentSelection(true)
  }, [setShowConsecutivePaymentSelection])

  const handleConsecutiveQrRetry = React.useCallback(() => {
    void handleConsecutivePayCard()
  }, [handleConsecutivePayCard])

  const handleConsecutiveQrComplete = React.useCallback(() => {
    setConsecutiveQrCheckout(createEmptyKioskQrCheckoutState())
    setConsecutiveOffer(null)
    setShowConsecutivePaymentSelection(false)
    setShowConsecutiveOverlay(false)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveOffer, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  // ─── Poll consecutive QR checkout status ────────────────────
  useKioskQrCheckoutPoller({
    checkoutState: consecutiveQrCheckout,
    setCheckoutState: setConsecutiveQrCheckout,
    onComplete: handleConsecutiveQrComplete,
  })

  // ─── UI handlers ────────────────────────────────────────────
  const handleExistingClick = React.useCallback(() => {
    void reloadCatalogCourses()
    setMode("existing")
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    resetKioskPinFlow()
    if (!selectedCourse || !contextIsValid) {
      setError("We couldn't open the purchase because QR data is missing.")
      return
    }
    if (isKioskTerminalFlow && !hasActiveClerkSession) {
      return
    }
    if (!hasActiveClerkSession) {
      setShowPhoneSignIn(true)
      return
    }
    void loadBootstrap()
  }, [contextIsValid, hasActiveClerkSession, isKioskTerminalFlow, loadBootstrap, reloadCatalogCourses, resetKioskPinFlow, selectedCourse, setBootstrap])

  const handleNewClick = React.useCallback(() => {
    void reloadCatalogCourses()
    setMode("new")
    setError(null)
    setSuccess(null)
    if (!selectedCourse || !contextIsValid) {
      setError("We couldn't open the purchase because QR data is missing.")
      return
    }
    setNewBookingOverride({
      courseSlug: selectedCourse.slug,
      date: activeDate,
      time: activeTime,
    })

    // New users go directly to EnrollModal — packages are selected in a dedicated
    // step AFTER user info is collected (to determine new vs existing pricing)
    // Gate: wait for consecutive offer fetch to settle so EnrollModal has the offer
    if (consecutiveOfferSettled) {
      setOpenNewBooking(true)
    } else {
      setPendingNewBooking(true)
    }
  }, [activeDate, activeTime, contextIsValid, reloadCatalogCourses, selectedCourse, consecutiveOfferSettled, setPendingNewBooking])

  // Open EnrollModal once consecutive offer fetch settles if user clicked "New Student" early
  React.useEffect(() => {
    if (pendingNewBooking && consecutiveOfferSettled) {
      setOpenNewBooking(true)
      setPendingNewBooking(false)
    }
  }, [pendingNewBooking, consecutiveOfferSettled, setPendingNewBooking])

  const handleLatePaymentTablet = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    setMode("idle")
  }, [latePaymentRecommendation, setBootstrap])

  const handleLatePaymentPhone = React.useCallback(() => {
    if (!display.latePaymentQrLink || typeof window === "undefined") return
    window.open(display.latePaymentQrLink, "_blank", "noopener,noreferrer")
  }, [display.latePaymentQrLink])

  const handleLatePaymentExisting = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    void reloadCatalogCourses()
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    resetKioskPinFlow()
    setLatePaymentEntryOverride({
      courseSlug: latePaymentRecommendation.courseSlug,
      date: latePaymentRecommendation.date,
      time: latePaymentRecommendation.time,
    })
    setMode("existing")
  }, [latePaymentRecommendation, reloadCatalogCourses, resetKioskPinFlow, setBootstrap])

  const handleLatePaymentNew = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    void reloadCatalogCourses()
    setError(null)
    setSuccess(null)
    setMode("new")
    setNewBookingOverride({
      courseSlug: latePaymentRecommendation.courseSlug,
      date: latePaymentRecommendation.date,
      time: latePaymentRecommendation.time,
    })
    setOpenNewBooking(true)
  }, [latePaymentRecommendation, reloadCatalogCourses])

  const handlePhoneSignInSuccess = React.useCallback(async () => {
    clearSuppressedClerkSessionId()
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    setBootstrap(null)
  }, [clearSuppressedClerkSessionId, setBootstrap])

  const handlePhoneSignInSession = React.useCallback(async (sessionId: string) => {
    registerKioskClerkSession(sessionId)
  }, [registerKioskClerkSession])

  const handleSwitchAccount = React.useCallback(() => {
    void clerk.signOut({
      redirectUrl: forceRedirectUrl,
      ...(activeSessionId ? { sessionId: activeSessionId } : {}),
    })
  }, [activeSessionId, clerk, forceRedirectUrl])

  const [returnedFromNewStudentFlow, setReturnedFromNewStudentFlow] = React.useState(false)

  const handleExistingUserDetected = React.useCallback(() => {
    setOpenNewBooking(false)
    setNewBookingOverride(null)
    setPendingLoginPhone("")
    setShowPhoneSignIn(false)
    setReturnedFromNewStudentFlow(true)
    setMode("existing")
  }, [])

  // Clear the "returned from new student" flag when leaving existing mode
  React.useEffect(() => {
    if (mode !== "existing") setReturnedFromNewStudentFlow(false)
  }, [mode])

  const handleNewUserPostPurchase = React.useCallback(async () => {
    // After new-student purchase, check for consecutive offer before resetting.
    if (isKioskTerminalFlow) {
      setOpenNewBooking(false)      // close modal so consecutive overlay is visible
      setNewBookingOverride(null)   // clean up override
      const hasOffer = await checkConsecutiveOfferAfterCheckIn()
      if (!hasOffer) {
        refreshConsecutiveOffer()
        void handleStationCompletion()
      }
      return
    }
    void handleStationCompletion()
  }, [isKioskTerminalFlow, checkConsecutiveOfferAfterCheckIn, handleStationCompletion, refreshConsecutiveOffer])

  const handleBootstrapAction = React.useCallback(() => {
    if (processingPackageCheckIn) return
    if (!effectiveCheckInWindowOpen) {
      setError("The check-in window for this class is closed.")
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
    })
  }, [bootstrap, effectiveCheckInWindowOpen, handlePackageCheckIn, openExistingPurchaseFlow, processingPackageCheckIn, setError])

  const handleBackToCurrentClass = React.useCallback(() => {
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    setLatePaymentEntryOverride(null)
    setMode("idle")
  }, [setBootstrap])

  React.useEffect(() => {
    if (!bootstrap && packageOfferContext) {
      // Scenario 3 (new-user-upsell): offer is set AFTER first purchase completes,
      // when bootstrap may be null. Don't clear it.
      if (!shouldPreserveOfferOnBootstrapClear(packageOfferContext.scenario)) {
        setPackageOfferContext(null)
        setPackageOfferSelectedId(null)
      }
    }
  }, [bootstrap, packageOfferContext])

  // ─── Effects ────────────────────────────────────────────────
  React.useEffect(() => {
    if (mode !== "existing") return
    if (!isLoaded) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) return
    void loadBootstrap()
  }, [hasActiveClerkSession, isLoaded, kioskPinSessionToken, loadBootstrap, mode])

  React.useEffect(() => {
    if (
      shouldAutoPromoteExistingMode({
        entryMode,
        mode,
        hasActiveClerkSession,
        isKioskTerminalFlow,
      })
    ) {
      setMode("existing")
    }
  }, [entryMode, hasActiveClerkSession, isKioskTerminalFlow, mode])

  React.useEffect(() => {
    if (!hasActiveClerkSession) return
    if (showPhoneSignIn) {
      setShowPhoneSignIn(false)
    }
  }, [hasActiveClerkSession, showPhoneSignIn])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setInternalNowTick(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    setOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(max-width: 1023px)")
    const syncViewport = () => setIsCompactViewport(media.matches)
    syncViewport()
    media.addEventListener("change", syncViewport)
    return () => media.removeEventListener("change", syncViewport)
  }, [])

  React.useEffect(() => {
    if (!isKioskTerminalFlow) return
    if (!bootstrap) return

    // Check for duplicate purchase BEFORE opening the flow
    if (bootstrap.hasExistingPurchaseForSession) {
      if (
        showConsecutiveOverlay ||
        showConsecutivePaymentSelection ||
        Boolean(consecutiveOffer) ||
        Boolean(packageCheckInResult) ||
        consecutiveQrCheckout.phase !== "idle"
      ) {
        return
      }
      setShowDuplicatePurchasePopup(true)
      return
    }

    // Package offer screen removed - packages step is now in EnrollModal
    if (
      !shouldAutoOpenExistingPurchase({
        mode,
        hasBootstrap: true,
        isSignedIn: hasActiveClerkSession,
        hasKioskPinSession,
        loadingBootstrap,
        hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
        openNewBooking,
        processingPackageCheckIn,
        hasPackage: Boolean(bootstrap.package),
      })
    ) {
      return
    }

    // Go directly to existing purchase flow - packages step is now integrated there
    openExistingPurchaseFlow({
      courseSlug: bootstrap.context.courseSlug,
      date: bootstrap.context.date,
      time: bootstrap.context.time,
    })
  }, [
    bootstrap,
    consecutiveOffer,
    consecutiveOfferSettled,
    consecutiveQrCheckout.phase,
    existingRegularBookingOverride,
    hasActiveClerkSession,
    hasKioskPinSession,
    isKioskTerminalFlow,
    loadingBootstrap,
    mode,
    openExistingPurchaseFlow,
    openNewBooking,
    packageCheckInResult,
    processingPackageCheckIn,
    showConsecutiveOverlay,
    showConsecutivePaymentSelection,
    hasUsablePackageForCurrentClass,
  ])



  // Auto-trigger package check-in on kiosk: PIN identify → bootstrap with package → deduct immediately
  // GATED: when a consecutive offer exists and is settled, show offer first instead of auto-checking-in
  React.useEffect(() => {
    if (
      !shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow,
        mode,
        hasPackage: hasUsablePackageForCurrentClass,
        processingPackageCheckIn,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        hasExistingPurchaseForSession: Boolean(bootstrap?.hasExistingPurchaseForSession),
        effectiveCheckInWindowOpen,
        hasActiveSession: hasActiveClerkSession || hasKioskPinSession,
        hasConsecutiveOffer: Boolean(consecutiveOffer),
        consecutiveOfferSettled,
      })
    ) {
      // Gate returned false — distinguish: settled offer (show overlay) vs wait/other reasons
      // Only show overlay for PACKAGE HOLDERS — non-package users go through EnrollModal which has consecutive step
      if (shouldShowConsecutiveOfferGate({
        hasConsecutiveOffer: Boolean(consecutiveOffer),
        consecutiveOfferSettled,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        mode,
        hasBootstrap: Boolean(bootstrap),
        hasPackage: hasUsablePackageForCurrentClass,
        showConsecutivePaymentSelection,
        awaitingConsecutivePaymentSelection,
        isConsecutiveQrCheckoutIdle: consecutiveQrCheckout.phase === "idle",
        hasConsecutiveSuccess: Boolean(consecutiveSuccess),
        hasConsecutiveError: Boolean(consecutiveError),
      })) {
        setShowConsecutivePaymentSelection(false)
        setShowConsecutiveOverlay(true)
      }
      return
    }
    void handlePackageCheckIn()
  }, [
    bootstrap,
    consecutiveOffer,
    consecutiveError,
    consecutiveOfferSettled,
    consecutiveQrCheckout.phase,
    consecutiveSuccess,
    effectiveCheckInWindowOpen,
    handlePackageCheckIn,
    hasActiveClerkSession,
    hasKioskPinSession,
    isKioskTerminalFlow,
    mode,
    awaitingConsecutivePaymentSelection,
    packageCheckInResult,
    processingPackageCheckIn,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    showConsecutivePaymentSelection,
    hasUsablePackageForCurrentClass,
  ])

  React.useEffect(() => {
    if (
      !shouldSurfaceClosedWindowPackageError({
        isKioskTerminalFlow,
        mode,
        hasBootstrap: Boolean(bootstrap),
        hasPackage: hasUsablePackageForCurrentClass,
        effectiveCheckInWindowOpen,
        processingPackageCheckIn,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
      })
    ) {
      return
    }

    setError("The check-in window for this class is closed.")
  }, [
    bootstrap,
    effectiveCheckInWindowOpen,
    existingRegularBookingOverride,
    hasUsablePackageForCurrentClass,
    isKioskTerminalFlow,
    mode,
    packageCheckInResult,
    processingPackageCheckIn,
  ])

  React.useEffect(() => {
    if (showKioskPinPanel) return
    if (!error && !success) return
    const timeoutId = window.setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, TRANSIENT_MESSAGE_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [error, showKioskPinPanel, success])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const hasSensitiveState = hasTerminalSensitiveCustomerState({
      isKioskTerminalFlow,
      mode,
      bootstrapOpen: Boolean(bootstrap),
      newBookingOpen: openNewBooking || Boolean(newBookingOverride),
      existingBookingOpen: Boolean(existingRegularBookingOverride),
      phoneSignInOpen: showPhoneSignIn,
      packageOfferOpen: Boolean(packageOfferContext),
      duplicatePurchaseOpen: showDuplicatePurchasePopup || Boolean(bootstrap?.hasExistingPurchaseForSession),
      packageSuccessOpen: Boolean(packageCheckInResult),
      kioskPinOpen: showKioskPinPanel,
      kioskPinSessionActive: hasKioskPinSession,
      pendingLoginPhone: Boolean(pendingLoginPhone),
      consecutiveOfferOpen: Boolean(showConsecutiveOverlay && consecutiveOffer),
      consecutiveSuccessOpen: Boolean(consecutiveSuccess),
      consecutiveErrorOpen: Boolean(consecutiveError),
      qrCheckoutOpen: consecutiveQrCheckout.phase !== "idle",
    })

    // Notify parent (StaffTerminalShell) about flow active state for rotation guard
    onFlowActiveChange?.(hasSensitiveState)

    if (!hasSensitiveState) return

    const controller = createKioskInactivityController({
      onTimeout: () => {
        void handleStationCompletion()
      },
    })
    const handleActivity = () => controller.arm()
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"]

    controller.arm()
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity)
      }
      controller.dispose()
    }
  }, [
    bootstrap,
    consecutiveError,
    consecutiveOffer,
    consecutiveQrCheckout.phase,
    consecutiveSuccess,
    existingRegularBookingOverride,
    handleStationCompletion,
    hasKioskPinSession,
    isKioskTerminalFlow,
    mode,
    newBookingOverride,
    onFlowActiveChange,
    openNewBooking,
    packageCheckInResult,
    packageOfferContext,
    showConsecutiveOverlay,
    pendingLoginPhone,
    showDuplicatePurchasePopup,
    showKioskPinPanel,
    showPhoneSignIn,
  ])

  // ─── Render ─────────────────────────────────────────────────
  const isTerminal = shellVariant === "terminal"
  const entrySelectionButtons = !hideEntrySelection ? (
    <EntrySelectionButtons
      mode={mode}
      isKioskTerminalFlow={isKioskTerminalFlow}
      onExisting={handleExistingClick}
      onNew={handleNewClick}
      variant={showCourseCardPanel && showQrPanel ? "embedded" : "standalone"}
    />
  ) : null
  const hasEmbeddedEntrySelection = Boolean(entrySelectionButtons && showCourseCardPanel && showQrPanel)

  return (
    <main className={`relative ${isTerminal ? "h-dvh" : "min-h-screen"} overflow-hidden bg-[#13141d] px-3 ${mainSpacingClass} sm:px-4`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="relative mx-auto w-full max-w-[68rem]">
        <section className={`flex flex-col ${isTerminal ? "flex-1 min-h-0" : "min-h-[60rem] rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.26),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-4 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6"}`}>
          <CheckInHeader
            variant={shellVariant === "terminal" ? "terminal" : "personal"}
            eyebrow={shellEyebrow}
            welcomeLabel={welcomeLabel}
            showWelcome={showSignedInBootstrapPanel && Boolean(bootstrap)}
            breadcrumbItems={breadcrumbItems}
            terminalName={terminalName}
            terminalLocation={terminalLocation}
          />

          <div className={`${isTerminal ? "mt-8 min-h-0 overflow-hidden" : "mt-6"} flex flex-1 flex-col justify-center`}>
            {showCourseCardPanel && showQrPanel && (
              <CourseCardPanel
                cardImage={checkInCardImage}
                courseTitle={checkInDisplayCourse?.title || "Current course"}
                category={checkInCardCategory}
                badge={checkInCardBadge}
                duration={checkInCardDuration}
                students={checkInCardStudents}
                description={checkInCardDescription}
                teacher={checkInCardTeacher}
                displayDate={checkInDisplayDate}
                displayTime={checkInDisplayTime}
                qrImage={checkInQrImage}
                compact={isTerminal}
                actionSlot={hasEmbeddedEntrySelection ? entrySelectionButtons : undefined}
              />
            )}
            {showCourseCardPanel && !showQrPanel && (
              <CourseCardPanel
                cardImage={checkInCardImage}
                courseTitle={checkInDisplayCourse?.title || "Current course"}
                category={checkInCardCategory}
                badge={checkInCardBadge}
                duration={checkInCardDuration}
                students={checkInCardStudents}
                description={checkInCardDescription}
                teacher={checkInCardTeacher}
                displayDate={checkInDisplayDate}
                displayTime={checkInDisplayTime}
                compact={isTerminal}
              />
            )}
            {showQrPanel && !hasEmbeddedEntrySelection && (
              <QrPromptText variant={shellVariant === "terminal" ? "terminal" : "personal"} />
            )}

            {showContextWarning && <ContextWarning />}

            {showLatePaymentOffer && (
              <LatePaymentPanel
                courseTitle={latePaymentCourse?.title || "Previous class"}
                date={latePaymentRecommendation?.date || ""}
                time={latePaymentRecommendation?.time || ""}
                qrImage={latePaymentQrImage}
                onUseTablet={handleLatePaymentTablet}
                onOpenPhone={handleLatePaymentPhone}
                onExistingCustomer={handleLatePaymentExisting}
                onNewCustomer={handleLatePaymentNew}
              />
            )}

            {!hasEmbeddedEntrySelection && entrySelectionButtons}

            {showKioskPinPanel && (
              <KioskPinModal
                title={returnedFromNewStudentFlow ? "Welcome back!" : kioskPinPanelCopy.title}
                description={returnedFromNewStudentFlow ? "You\u0027re already a registered customer. Enter your PIN to continue with regular pricing." : kioskPinPanelCopy.description}
                onClose={handleExistingCustomerDismiss}
                hasSession={hasKioskPinSession}
                entryPin={kioskPin}
                entryRevealedIndex={entryRevealedIndex}
                entryActiveSlot={entryActiveSlot}
                isEntryActive={activePinField === "entry"}
                attemptsRemaining={kioskPinAttemptsRemaining}
                throttleSeverity={kioskPinThrottleSeverity}
                blockedUntilLabel={kioskPinBlockedUntil
                  ? kioskPinThrottleSeverity === "emergency"
                    ? `This terminal is temporarily protected until ${toEsDateTime(kioskPinBlockedUntil)}.`
                    : `Please wait until ${toEsDateTime(kioskPinBlockedUntil)} before trying this PIN again.`
                  : null}
                onIdentify={handleKioskPinIdentify}
                canIdentify={canIdentify}
                isIdentifying={kioskPinLoading}
                nextPin={kioskPinNext}
                nextRevealedIndex={nextRevealedIndex}
                nextActiveSlot={nextActiveSlot}
                isNextActive={activePinField === "next"}
                confirmPin={kioskPinConfirm}
                confirmRevealedIndex={confirmRevealedIndex}
                confirmActiveSlot={confirmActiveSlot}
                isConfirmActive={activePinField === "confirm"}
                onRotate={handleKioskPinRotate}
                canRotate={canRotate}
                isRotating={kioskPinRotating}
                onDigit={handlePinDigitInput}
                onBackspace={handlePinBackspace}
                onClear={handlePinClear}
                isKeypadDisabled={hasKioskPinSession ? kioskPinRotating : kioskPinLoading}
                visibleError={visibleError}
                success={success}
              />
            )}

            {showSignedInBootstrapPanel && (
              <SignedInBootstrapPanel
                loading={loadingBootstrap}
                bootstrap={bootstrap}
                courseImage={bootstrapCourseImage}
                cardCategory={bootstrapCardCategory}
                cardBadge={bootstrapCardBadge}
                cardDuration={bootstrapCardDuration}
                cardStudents={bootstrapCardStudents}
                cardDescription={bootstrapCardDescription}
                cardTeacher={bootstrapCardTeacher}
                quickCheckoutDetails={quickCheckoutDetails}
                isLatePaymentContext={isLatePaymentContext}
                hasFixedRecommendation={Boolean(display.fixedContextRecommendation)}
                checkInWindowOpen={effectiveCheckInWindowOpen}
                processingPackageCheckIn={processingPackageCheckIn}
                checkInWindowLabel={
                  bootstrap
                    ? `Check-in window: ${toEsDateTime(bootstrap.context.checkInWindow.opensAt)} to ${toEsDateTime(bootstrap.context.checkInWindow.closesAt)}`
                    : ""
                }
                packageExpiresLabel={bootstrap?.package?.expiresAt ? toEsDateTime(bootstrap.package.expiresAt) : undefined}
                onSwitchAccount={handleSwitchAccount}
                onAction={handleBootstrapAction}
                onBackToCurrentClass={handleBackToCurrentClass}
              />
            )}

            <InlineFeedback error={visibleError} success={success} />
          </div>
        </section>
      </div>

      {/* Duplicate purchase overlay - show immediately when bootstrap has the flag */}
      {(showDuplicatePurchasePopup || (bootstrap?.hasExistingPurchaseForSession && !showConsecutiveOverlay)) && (
        <KioskDuplicatePurchaseOverlay
          customerName={bootstrap?.customer?.firstName}
          courseTitle={bootstrap?.context?.courseTitle}
          remainingCredits={bootstrap?.package?.remainingCredits ?? null}
          hasConsecutiveOffer={Boolean(bootstrap?.consecutiveOffer || consecutiveOffer)}
          autoDoneMs={10_000}
          onDone={() => {
            setShowDuplicatePurchasePopup(false)
            const offer = bootstrap?.consecutiveOffer || consecutiveOffer
            const action = resolveDuplicatePurchaseDoneAction({
              hasConsecutiveOffer: Boolean(offer),
        hasPackage: hasUsablePackageForCurrentClass,
            })
            if (action === "open-consecutive-overlay" && offer) {
              setConsecutiveOffer(offer)
              setShowConsecutivePaymentSelection(false)
              setShowConsecutiveOverlay(true)
              return
            }
            // No usable current-class package → defer to the regular
            // registered-customer purchase flow path (station completion;
            // duplicate-purchase implies class A is already recorded).
            void handleStationCompletion()
          }}
        />
      )}

      {newBookingCourse && (
        <EnrollModal
          course={newBookingCourse}
          open={openNewBooking}
          onCloseAction={() => {
            if (isKioskTerminalFlow) {
              void handleStationCompletion()
              return
            }
            setOpenNewBooking(false)
            setNewBookingOverride(null)
          }}
          initialStep={0}
          flowVariant="checkin-new"
          completionMode={isKioskTerminalFlow ? "station" : completionMode}
          checkInContext={newBookingContext}
          photoFlowContext={photoFlowContext}
          kioskSessionToken={!hasActiveClerkSession && kioskPinSessionToken ? kioskPinSessionToken : undefined}
          useDraft={false}
          mode="modal"
          preventOutsideClose={isKioskTerminalFlow}
          onCompletedAction={isKioskTerminalFlow ? handleNewUserPostPurchase : undefined}
          onTimeoutAction={isKioskTerminalFlow ? handleStationCompletion : undefined}
          onExistingUserDetected={isKioskTerminalFlow ? handleExistingUserDetected : undefined}
          onKioskSessionCreated={isKioskTerminalFlow ? registerKioskClerkSession : undefined}
          consecutiveOffer={undefined}
          isPackageHolder={false}
        />
      )}

      {packageCheckInResult && (
        <KioskPackageSuccessOverlay
          remainingCredits={packageCheckInResult.remainingCredits}
          points={packageCheckInResult.points}
          onDone={handlePackageSuccessDone}
        />
      )}

      {/* KioskPackageOfferScreen removed - packages step is now integrated in EnrollModal flow */}

      {showKioskResolvingOverlay && !packageCheckInResult && !showDuplicatePurchasePopup && !bootstrap?.hasExistingPurchaseForSession && (
        <KioskResolvingOverlay
          message={processingPackageCheckIn ? "Checking you in\u2026" : undefined}
        />
      )}

      {/* ─── Consecutive offer flow (two-phase: accept → payment selection → success) ──────────────────────────── */}
      {showConsecutiveOverlay && hasUsablePackageForCurrentClass && consecutiveOffer && !consecutiveSuccess && !consecutiveError && consecutiveQrCheckout.phase === "idle" && (
        <ConsecutiveClassOffer
          offer={consecutiveOffer}
          isPackageHolder={hasUsablePackageForCurrentClass}
          onAccept={handleConsecutiveAccept}
          onDecline={handleConsecutiveDecline}
          onPayCash={handleConsecutivePayCash}
          onPayCard={handleConsecutivePayCard}
          isProcessing={consecutiveProcessing}
          processingAction={consecutiveProcessingAction}
          showPaymentSelection={showConsecutivePaymentSelection}
        />
      )}

      {consecutiveSuccess && (
        <ConsecutiveOfferSuccess
          courseTitle={consecutiveSuccess.courseTitle}
          onDone={handleConsecutiveSuccessDone}
        />
      )}

      {consecutiveError && consecutiveOffer && (
        <ConsecutiveOfferError
          error={consecutiveError}
          onRetry={handleConsecutiveRetry}
          onDismiss={handleConsecutiveErrorDismiss}
        />
      )}

      {/* ─── Consecutive card QR payment panel ──────────────────────────── */}
      {consecutiveQrCheckout.phase !== "idle" && (
        <KioskQrPaymentPanel
          checkoutState={consecutiveQrCheckout}
          onCancel={handleConsecutiveQrCancel}
          onRetry={handleConsecutiveQrRetry}
        />
      )}

      {showPhoneSignIn && !hasActiveClerkSession && (
        <PhoneSignInModal
          redirectUrl={forceRedirectUrl}
          phoneNumber={toE164Phone(pendingLoginPhone)}
          useNumericKeypad={photoFlowContext === "kiosk_terminal"}
          onSessionCreated={handlePhoneSignInSession}
          onSuccess={handlePhoneSignInSuccess}
          onClose={handleExistingCustomerDismiss}
        />
      )}

      {existingRegularBookingCourse && (
        <EnrollModal
          key={`existing-regular-${existingRegularBookingKey}-${existingRegularBookingOverride?.courseSlug || existingRegularBookingCourse.slug}-${existingRegularBookingOverride?.date || ""}-${existingRegularBookingOverride?.time || ""}`}
          course={existingRegularBookingCourse}
          open={Boolean(existingRegularBookingOverride)}
          onCloseAction={() => {
            if (isKioskTerminalFlow) {
              void handleStationCompletion()
              return
            }
            setExistingRegularBookingOverride(null)
          }}
          onPaymentsStepReadyAction={isKioskTerminalFlow ? () => setPaymentsModalReady(true) : undefined}
          initialStep={getExistingCustomerInitialStep({
            isKioskTerminalFlow,
            hasPrefilledContact: hasBootstrapPrefilledContact,
            requiresPhotoStep: !bootstrap?.customer.hasAvatar && photoFlowContext === "kiosk_terminal",
            hasPackages: (existingRegularBookingCourse?.enrollment.packages.length ?? 0) > 0,
            hasActivePackage: hasUsablePackageForCurrentClass,
          })}
          prefillSelection={pickEnrollPrefill({
            quickCheckout: bootstrap?.quickCheckout ?? null,
            selectedPackageId: packageOfferSelectedId,
          })}
          flowVariant="checkin-existing"
          completionMode={isKioskTerminalFlow ? "station" : completionMode}
          checkInContext={existingRegularBookingContext}
          kioskSessionToken={!hasActiveClerkSession && kioskPinSessionToken ? kioskPinSessionToken : undefined}
          photoFlowContext={photoFlowContext}
          prefillHasAvatar={bootstrap?.customer.hasAvatar}
          useDraft={false}
          mode="modal"
          preventOutsideClose={isKioskTerminalFlow}
          onCompletedAction={isKioskTerminalFlow ? async () => {
            setExistingRegularBookingOverride(null)
            // If the EnrollModal already included the consecutive step, the offer was consumed — go straight to completion
            if (hasUsablePackageForCurrentClass && consecutiveOffer) {
              setConsecutiveOffer(null)
              // Re-fetch consecutive offer for the next student
              refreshConsecutiveOffer()
              void handleStationCompletion()
              return
            }
            const hasOffer = await checkConsecutiveOfferAfterCheckIn()
            if (!hasOffer) {
              // Re-fetch consecutive offer for the next student
              refreshConsecutiveOffer()
              void handleStationCompletion()
            }
          } : undefined}
          onTimeoutAction={isKioskTerminalFlow ? handleStationCompletion : undefined}
          prefillContact={bootstrapContact || undefined}
          consecutiveOffer={undefined}
          isPackageHolder={hasUsablePackageForCurrentClass}
        />
      )}
    </main>
  )
}
