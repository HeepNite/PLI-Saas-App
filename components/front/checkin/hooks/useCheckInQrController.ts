"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { demoCourses } from "@/constants/courses"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { useKioskCustomerSession } from "@/components/front/checkin/useKioskCustomerSession"
import { useKioskFlowCompletion } from "@/components/front/checkin/useKioskFlowCompletion"
import { useKioskPinFlow } from "@/components/front/checkin/useKioskPinFlow"
import { useCheckInQrShellProps } from "@/components/front/checkin/hooks/useCheckInQrShellProps"
import {
  createEmptyKioskQrCheckoutState,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import { useConsecutiveOfferUiHandlers } from "@/components/front/checkin/hooks/useConsecutiveOfferUiHandlers"
import { useCheckInPackageFlow } from "@/components/front/checkin/hooks/useCheckInPackageFlow"
import { useCheckInBootstrap } from "@/components/front/checkin/hooks/useCheckInBootstrap"
import { useConsecutiveOfferLookup } from "@/components/front/checkin/hooks/useConsecutiveOfferLookup"
import { useConsecutiveOfferState } from "@/components/front/checkin/hooks/useConsecutiveOfferState"
import { useConsecutiveOfferActions } from "@/components/front/checkin/hooks/useConsecutiveOfferActions"
import { useEntryModeRouter } from "@/components/front/checkin/hooks/useEntryModeRouter"
import { useCheckInBookingModalFlow } from "@/components/front/checkin/hooks/useCheckInBookingModalFlow"
import { parseDuration } from "@/lib/checkin/checkin-helpers"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import {
  resolveCheckInActiveContext,
  resolveCheckInBootstrapContextPayload,
} from "@/lib/checkin/checkin-bootstrap-context"
import { useCheckInTerminalEffects } from "@/components/front/checkin/hooks/useCheckInTerminalEffects"
import type {
  EntryMode,
  BootstrapResponse,
  CheckInQrClientProps,
  PackageOfferContext,
} from "@/components/front/checkin/checkin.types"
import type { CheckInQrShellProps } from "@/components/front/checkin/CheckInQrShell"

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full CheckIn QR flow and assembles all props for
 * `<CheckInQrShell />`. This is the single controller hook that owns
 * all state, derived values, sub-hook calls, and side-effects previously
 * living in the `CheckInQrClient` component body.
 */
export function useCheckInQrController({
  forcedDeviceMode,
  forcedCourseSlug = "",
  forcedClassContext,
  terminalTodayOnly,
  selectedCourseSlug,
  hideQrPanel = false,
  shellVariant = "qr",
  terminalName,
  terminalLocation,
  qrPathOverride,
  terminalPastClasses,
  selectedTerminalPastClass,
  onTerminalPastClassSelect,
  simulatedNowTick,
  onFlowActiveChange,
}: CheckInQrClientProps & { selectedCourseSlug?: string }): CheckInQrShellProps {
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
  const [returnedFromNewStudentFlow, setReturnedFromNewStudentFlow] = React.useState(false)
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
      forcedClassContext,
      selectedCourseSlug,
      nowTick,
      terminalTodayOnly,
    }),
    [forcedClassContext, forcedCourseSlug, nowTick, searchParams, selectedCourseSlug, shellVariant, sourceCourses, terminalTodayOnly]
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
    activeSessionId: activeSessionId ?? null,
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

  const checkConsecutiveOfferAfterCheckInFromRef = React.useCallback(
    () => checkConsecutiveOfferAfterCheckInRef.current(),
    []
  )
  const handleStationCompletionFromRef = React.useCallback(() => handleStationCompletionRef.current(), [])

  const effectiveCheckInWindowOpen = Boolean(bootstrap?.context.checkInWindow.isOpen)
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
    forcedClassContext,
    terminalTodayOnly,
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
    hasPackageCheckInResult: Boolean(packageCheckInResult),
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

  // ─── Booking modal orchestration ────────────────────────────
  const {
    newBookingCourse,
    newBookingContext,
    existingRegularBookingCourse,
    existingRegularBookingContext,
    existingRegularBookingInitialStep,
    existingRegularBookingPrefill,
    openExistingPurchaseFlow,
    handleDuplicatePurchaseDone,
    handleNewBookingClose,
    handleExistingBookingClose,
    handleExistingBookingCompleted,
  } = useCheckInBookingModalFlow({
    sourceCourses,
    selectedCourse,
    qrCourse,
    activeDate,
    activeTime,
    durationMinutes,
    bootstrap,
    hasBootstrapPrefilledContact,
    photoFlowContext,
    isKioskTerminalFlow,
    hasUsablePackageForCurrentClass,
    packageOfferSelectedId,
    consecutiveOffer,
    setExistingRegularBookingKey,
    setExistingRegularBookingOverride,
    setNewBookingOverride,
    setOpenNewBooking,
    setError,
    setSuccess,
    setPaymentsModalReady,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setShowDuplicatePurchasePopup,
    handleStationCompletion,
    checkConsecutiveOfferAfterCheckIn: checkConsecutiveOfferAfterCheckInFromRef,
    refreshConsecutiveOffer,
    newBookingOverride,
    existingRegularBookingOverride,
  })

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

  const {
    handleConsecutiveAccept,
    handleConsecutiveDecline,
    handleConsecutivePayCash,
    handleConsecutivePayCard,
    handleConsecutiveQrCancel,
    handleConsecutiveQrComplete,
  } = useConsecutiveOfferActions({
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
  })

  const {
    handleConsecutiveSuccessDone,
    handleConsecutiveRetry,
    handleConsecutiveErrorDismiss,
    handleConsecutiveQrRetry,
  } = useConsecutiveOfferUiHandlers({
    handleStationCompletion,
    refreshConsecutiveOffer,
    setConsecutiveSuccess,
    setShowConsecutiveOverlay,
    setConsecutiveError,
    setConsecutiveOffer,
    handleConsecutiveAccept,
    handleConsecutivePayCard,
    consecutiveQrCheckout,
    setConsecutiveQrCheckout,
    handleConsecutiveQrComplete,
  })

  // ─── UI handlers ────────────────────────────────────────────
  const {
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
  } = useEntryModeRouter({
    activeDate,
    activeTime,
    activeSessionId: activeSessionId ?? null,
    bootstrap,
    checkConsecutiveOfferAfterCheckIn,
    clearSuppressedClerkSessionId,
    clerkSignOut: clerk.signOut.bind(clerk),
    consecutiveOfferSettled,
    contextIsValid,
    displayLatePaymentQrLink: display.latePaymentQrLink ?? null,
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
  })

  // ─── Effects (lifecycle / terminal) ────────────────────────
  useCheckInTerminalEffects({
    bootstrap,
    loadingBootstrap,
    isLoaded,
    hasActiveClerkSession,
    kioskPinSessionToken,
    hasKioskPinSession,
    loadBootstrap,
    mode,
    setMode,
    entryMode,
    isKioskTerminalFlow,
    setInternalNowTick,
    setOrigin,
    setIsCompactViewport,
    showPhoneSignIn,
    setShowPhoneSignIn,
    packageOfferContext,
    setPackageOfferContext,
    setPackageOfferSelectedId,
    openNewBooking,
    existingRegularBookingOverride,
    newBookingOverride,
    processingPackageCheckIn,
    packageCheckInResult,
    hasUsablePackageForCurrentClass,
    effectiveCheckInWindowOpen,
    handlePackageCheckIn,
    consecutiveOffer,
    consecutiveOfferSettled,
    showConsecutiveOverlay,
    setShowConsecutiveOverlay,
    showConsecutivePaymentSelection,
    setShowConsecutivePaymentSelection,
    awaitingConsecutivePaymentSelection,
    consecutiveQrCheckout,
    consecutiveSuccess,
    consecutiveError,
    openExistingPurchaseFlow,
    setShowDuplicatePurchasePopup,
    error,
    success,
    setError,
    setSuccess,
    showKioskPinPanel,
    pendingLoginPhone,
    showDuplicatePurchasePopup,
    kioskPinSessionActive: hasKioskPinSession,
    handleStationCompletion,
    onFlowActiveChange,
  })

  // ─── Shell prop assembly ─────────────────────────────────────
  return useCheckInQrShellProps({
    shellVariant,
    mainSpacingClass,
    shellEyebrow,
    welcomeLabel,
    showSignedInBootstrapPanel,
    bootstrap,
    breadcrumbItems,
    terminalName,
    terminalLocation,
    showCourseCardPanel,
    showQrPanel,
    checkInCardImage,
    checkInDisplayCourse,
    checkInCardCategory,
    checkInCardBadge,
    checkInCardDuration,
    checkInCardStudents,
    checkInCardDescription,
    checkInCardTeacher,
    checkInDisplayDate,
    checkInDisplayTime,
    checkInQrImage,
    terminalPastClasses,
    selectedTerminalPastClass,
    onTerminalPastClassSelect,
    showContextWarning,
    showLatePaymentOffer,
    latePaymentCourse,
    latePaymentRecommendation,
    latePaymentQrImage,
    onLatePaymentTablet: handleLatePaymentTablet,
    onLatePaymentPhone: handleLatePaymentPhone,
    onLatePaymentExisting: handleLatePaymentExisting,
    onLatePaymentNew: handleLatePaymentNew,
    hideEntrySelection,
    mode,
    isKioskTerminalFlow,
    onExistingClick: handleExistingClick,
    onNewClick: handleNewClick,
    showKioskPinPanel,
    returnedFromNewStudentFlow,
    kioskPinPanelCopy,
    hasKioskPinSession,
    kioskPin,
    entryRevealedIndex,
    entryActiveSlot,
    activePinField,
    kioskPinAttemptsRemaining,
    kioskPinThrottleSeverity,
    kioskPinBlockedUntil,
    canIdentify,
    kioskPinLoading,
    kioskPinNext,
    nextRevealedIndex,
    nextActiveSlot,
    kioskPinConfirm,
    confirmRevealedIndex,
    confirmActiveSlot,
    canRotate,
    kioskPinRotating,
    onKioskPinIdentify: handleKioskPinIdentify,
    onKioskPinRotate: handleKioskPinRotate,
    onPinDigitInput: handlePinDigitInput,
    onPinBackspace: handlePinBackspace,
    onPinClear: handlePinClear,
    onExistingCustomerDismiss: handleExistingCustomerDismiss,
    visibleError,
    success,
    loadingBootstrap,
    bootstrapCourseImage,
    bootstrapCardCategory,
    bootstrapCardBadge,
    bootstrapCardDuration,
    bootstrapCardStudents,
    bootstrapCardDescription,
    bootstrapCardTeacher,
    quickCheckoutDetails,
    isLatePaymentContext,
    hasFixedRecommendation: Boolean(display.fixedContextRecommendation),
    effectiveCheckInWindowOpen,
    processingPackageCheckIn,
    onSwitchAccount: handleSwitchAccount,
    onBootstrapAction: handleBootstrapAction,
    onBackToCurrentClass: handleBackToCurrentClass,
    activeCourseHasUsablePackage: hasUsablePackageForCurrentClass,
    bootstrapContact,
    completionMode,
    consecutiveError,
    consecutiveOffer,
    consecutiveProcessing,
    consecutiveProcessingAction,
    consecutiveQrCheckout,
    consecutiveSuccess,
    existingRegularBookingContext,
    existingRegularBookingCourse,
    existingRegularBookingInitialStep,
    existingRegularBookingKey,
    existingRegularBookingOverride,
    forceRedirectUrl,
    hasActiveClerkSession,
    kioskPinSessionToken,
    newBookingContext,
    newBookingCourse,
    openNewBooking,
    packageCheckInResult,
    photoFlowContext,
    showConsecutiveOverlay,
    showConsecutivePaymentSelection,
    showDuplicatePurchasePopup,
    showKioskResolvingOverlay,
    showPhoneSignIn,
    pendingLoginPhone,
    prefillSelection: existingRegularBookingPrefill,
    onConsecutiveAccept: handleConsecutiveAccept,
    onConsecutiveDecline: handleConsecutiveDecline,
    onConsecutiveErrorDismiss: handleConsecutiveErrorDismiss,
    onConsecutivePayCard: handleConsecutivePayCard,
    onConsecutivePayCash: handleConsecutivePayCash,
    onConsecutiveQrCancel: handleConsecutiveQrCancel,
    onConsecutiveQrRetry: handleConsecutiveQrRetry,
    onConsecutiveRetry: handleConsecutiveRetry,
    onConsecutiveSuccessDone: handleConsecutiveSuccessDone,
    onDuplicateDone: handleDuplicatePurchaseDone,
    onExistingBookingClose: handleExistingBookingClose,
    onExistingBookingCompleted: handleExistingBookingCompleted,
    onExistingUserDetected: handleExistingUserDetected,
    onKioskSessionCreated: registerKioskClerkSession,
    onNewBookingClose: handleNewBookingClose,
    onNewBookingCompleted: handleNewUserPostPurchase,
    onPackageSuccessDone: handlePackageSuccessDone,
    onPaymentsStepReady: () => setPaymentsModalReady(true),
    onPhoneSignInClose: handleExistingCustomerDismiss,
    onPhoneSignInSession: handlePhoneSignInSession,
    onPhoneSignInSuccess: handlePhoneSignInSuccess,
    onStationCompletion: handleStationCompletion,
  })
}
