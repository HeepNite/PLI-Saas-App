"use client"

import React from "react"
import { usePathname } from "next/navigation"
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
import { requestCheckoutSessionApi } from "@/lib/checkin/checkin-qr-api"
import { useConsecutiveOfferUiHandlers } from "@/components/front/checkin/hooks/useConsecutiveOfferUiHandlers"
import { useKioskQrCheckoutPoller } from "@/components/front/checkin/hooks/useKioskQrCheckoutPoller"
import { useCheckInPackageFlow } from "@/components/front/checkin/hooks/useCheckInPackageFlow"
import { useCheckInBootstrap } from "@/components/front/checkin/hooks/useCheckInBootstrap"
import { useConsecutiveOfferLookup } from "@/components/front/checkin/hooks/useConsecutiveOfferLookup"
import { useConsecutiveOfferState } from "@/components/front/checkin/hooks/useConsecutiveOfferState"
import { useConsecutiveOfferActions } from "@/components/front/checkin/hooks/useConsecutiveOfferActions"
import { useEntryModeRouter } from "@/components/front/checkin/hooks/useEntryModeRouter"
import { useCheckInBookingModalFlow } from "@/components/front/checkin/hooks/useCheckInBookingModalFlow"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import { useCheckInTerminalEffects } from "@/components/front/checkin/hooks/useCheckInTerminalEffects"
import { useCheckInQrCoreState } from "@/components/front/checkin/hooks/useCheckInQrCoreState"
import type {
  BootstrapResponse,
  CheckInQrClientProps,
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
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, sessionId: activeSessionId } = useAuth()
  const clerk = useClerk()

  // ─── Core state (primitive state + derived context) ──────────
  const {
    searchParams,
    internalNowTick: _internalNowTick,
    setInternalNowTick,
    nowTick,
    origin,
    setOrigin,
    isCompactViewport,
    setIsCompactViewport,
    durationMinutes,
    mode,
    setMode,
    openNewBooking,
    setOpenNewBooking,
    newBookingOverride,
    setNewBookingOverride,
    latePaymentEntryOverride,
    setLatePaymentEntryOverride,
    showPhoneSignIn,
    setShowPhoneSignIn,
    pendingLoginPhone,
    setPendingLoginPhone,
    existingRegularBookingOverride,
    setExistingRegularBookingOverride,
    existingRegularBookingKey,
    setExistingRegularBookingKey,
    awaitingConsecutivePaymentSelection,
    setAwaitingConsecutivePaymentSelection,
    paymentsModalReady,
    setPaymentsModalReady,
    processingPackageCheckIn,
    setProcessingPackageCheckIn,
    error,
    setError,
    success,
    setSuccess,
    showDuplicatePurchasePopup,
    setShowDuplicatePurchasePopup,
    packageOfferContext,
    setPackageOfferContext,
    packageOfferSelectedId,
    setPackageOfferSelectedId,
    returnedFromNewStudentFlow,
    setReturnedFromNewStudentFlow,
    consecutiveQrCheckout,
    setConsecutiveQrCheckout,
    preDisplayActiveContext,
    contextPayload,
    visibleError,
    photoFlowContext,
    isKioskTerminalFlow,
  } = useCheckInQrCoreState({
    sourceCourses,
    shellVariant,
    forcedCourseSlug,
    forcedClassContext,
    selectedCourseSlug,
    terminalTodayOnly,
    simulatedNowTick,
  })

  const setBootstrapRef = React.useRef<React.Dispatch<React.SetStateAction<BootstrapResponse | null>>>(() => {})
  const setBootstrapFromRef = React.useCallback<React.Dispatch<React.SetStateAction<BootstrapResponse | null>>>(
    (value) => setBootstrapRef.current(value),
    []
  )
  const handleStationCompletionRef = React.useRef<() => void | Promise<void>>(() => {})
  const checkConsecutiveOfferAfterCheckInRef = React.useRef<() => Promise<boolean>>(async () => false)

  // ─── Quick repeat overlay state ──────────────────────────────
  const [showQuickRepeat, setShowQuickRepeat] = React.useState(false)
  const [quickRepeatProcessing, setQuickRepeatProcessing] = React.useState(false)
  const [quickRepeatSuccess, setQuickRepeatSuccess] = React.useState(false)
  const [quickRepeatSuccessChannel, setQuickRepeatSuccessChannel] = React.useState<"cash" | "card" | null>(null)
  const [quickRepeatQrCheckout, setQuickRepeatQrCheckout] = React.useState<KioskQrCheckoutState>(
    createEmptyKioskQrCheckoutState()
  )

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
    activeCourseSlug: latePaymentEntryOverride?.courseSlug ?? newBookingOverride?.courseSlug ?? preDisplayActiveContext.activeCourseSlug,
    activeDate: latePaymentEntryOverride?.date ?? newBookingOverride?.date ?? preDisplayActiveContext.activeDate,
    activeTime: latePaymentEntryOverride?.time ?? newBookingOverride?.time ?? preDisplayActiveContext.activeTime,
  })

  // ─── Kiosk hooks ────────────────────────────────────────────
  const {
    kioskPhone,
    kioskPhoneLoading,
    setKioskPhone,
    handleKioskPhoneIdentify,
    handlePinDigitInput,
    handlePinBackspace,
    handlePinClear,
    hasKioskPinSession,
    kioskPinSessionToken,
    setKioskPinSessionToken,
    kioskPinAttemptsRemaining,
    setKioskPinAttemptsRemaining,
    kioskPinBlockedUntil,
    setKioskPinBlockedUntil,
    kioskPinThrottleSeverity,
    setKioskPinThrottleSeverity,
    resetKioskPinFlow,
  } = useKioskPinFlow<BootstrapResponse>({
    isKioskTerminalFlow,
    contextPayload,
    setBootstrap: setBootstrapFromRef,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setError,
    setSuccess,
  })

  // PIN rotation is removed — these stubs satisfy hooks that still reference them
  const kioskPinRotationRequired = false
  const setKioskPin = React.useCallback((_v: string | ((_: string) => string)) => {}, [])
  const setKioskPinConfirm = React.useCallback((_v: string | ((_: string) => string)) => {}, [])
  const setKioskPinNext = React.useCallback((_v: string | ((_: string) => string)) => {}, [])
  const setKioskPinRotationMode = React.useCallback((_v: unknown) => {}, [])
  const setKioskPinRotationRequired = React.useCallback((_v: boolean | ((_: boolean) => boolean)) => {}, [])

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
    kioskPinSessionToken,
    photoFlowContext,
    setError,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
  })
  setBootstrapRef.current = setBootstrap

  // Activate quick repeat overlay when bootstrap signals eligibility.
  // (quickRepeatEligible is already false when the customer has a usable package
  // for this class — a package holder checks in with their package, not a repeat
  // purchase; see the bootstrap decision builders.)
  React.useEffect(() => {
    if (bootstrap?.quickRepeatEligible && isKioskTerminalFlow) {
      setShowQuickRepeat(true)
      setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
    }
  }, [bootstrap?.quickRepeatEligible, isKioskTerminalFlow])

  const checkConsecutiveOfferAfterCheckInFromRef = React.useCallback(
    () => checkConsecutiveOfferAfterCheckInRef.current(),
    []
  )
  const handleStationCompletionFromRef = React.useCallback(() => handleStationCompletionRef.current(), [])

  const effectiveCheckInWindowOpen = Boolean(bootstrap?.context.checkInWindow.isOpen)
  const {
    packageCheckInResult,
    setPackageCheckInResult,
    packageCheckInFailure,
    packageCheckInAttempts,
    retryBackoffActive,
    clearPackageCheckInBackoff,
    setPackageCheckInAttempts,
    setPackageCheckInFailure,
    performPackageCheckInApi,
    handlePackageCheckIn,
    handlePackageSuccessDone,
    handleRetryPackageCheckIn,
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
    searchParams: searchParams as URLSearchParams,
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
    loadingBootstrap,
    bootstrap,
    visibleError,
    paymentsModalReady,
    existingRegularBookingOverride,
    openNewBooking,
    processingPackageCheckIn,
    hasPackageCheckInResult: Boolean(packageCheckInResult),
    hasPackageCheckInFailure: Boolean(packageCheckInFailure),
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
    showPackageCheckInFailureOverlay,
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
    clearPackageCheckInBackoff,
    setPackageCheckInAttempts,
    setPackageCheckInFailure,
  })
  handleStationCompletionRef.current = handleStationCompletion

  // ─── Quick repeat handlers ───────────────────────────────────
  const handleQuickRepeatDecline = React.useCallback(() => {
    setShowQuickRepeat(false)
    setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
    // Fall through to the existing student flow — openExistingPurchaseFlow is
    // called reactively by the bootstrap effect when existingRegularBookingOverride
    // is set. We just clear the overlay gate here; the existing terminal flow
    // already handles the rest.
  }, [])

  const handleQuickRepeatConfirm = React.useCallback(async (
    paymentChannel: "cash" | "card",
    consecutiveAccepted: boolean,
  ) => {
    if (!bootstrap) return
    const { context, customer, consecutiveOffer: bsConsecutiveOffer, lastPurchasePattern } = bootstrap

    setQuickRepeatProcessing(true)

    if (paymentChannel === "cash") {
      try {
        const baseAmountCents = lastPurchasePattern?.amount ?? 0
        const consecutiveOffer = consecutiveAccepted ? bsConsecutiveOffer ?? null : null
        const consecutivePriceCents = consecutiveAccepted && consecutiveOffer
          ? (consecutiveOffer.dropInConsecutiveCents ?? null)
          : null
        const amountCents = baseAmountCents + (consecutivePriceCents ?? 0)

        const payload: Record<string, unknown> = {
          courseSlug: context.courseSlug,
          courseTitle: context.courseTitle,
          amount: amountCents,
          currency: "usd",
          date: context.date,
          time: context.time,
          firstName: customer.firstName,
          lastName: customer.lastName,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          participants: 1,
          addons: [],
          serviceId: lastPurchasePattern?.paymentChannel === "package" ? "package" : "dropin",
          photoContext: "kiosk_terminal",
          flowContext: "kiosk_terminal",
          ...(kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
          ...(consecutiveOffer && consecutivePriceCents != null
            ? {
                consecutivePriceCents,
                consecutiveLinkedCourseSlug: consecutiveOffer.linkedCourseSlug,
                consecutiveCourseTitle: consecutiveOffer.linkedCourseTitle,
                consecutiveLinkedCourseTime: consecutiveOffer.linkedCourseTime ?? context.time,
              }
            : {}),
        }

        const res = await fetch("/api/checkout/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          const errorMsg = typeof data?.error === "string" ? data.error : "Quick check-in failed. Please try again."
          console.error("[QuickRepeat] Cash checkout failed:", errorMsg)
          setError(errorMsg)
          setShowQuickRepeat(false)
          setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
          return
        }

        // Show success screen inside the overlay, then complete after delay
        setQuickRepeatSuccessChannel("cash")
        setQuickRepeatSuccess(true)
        setTimeout(() => {
          setShowQuickRepeat(false)
          setQuickRepeatSuccess(false)
          setQuickRepeatSuccessChannel(null)
          setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
          void handleStationCompletionFromRef()
        }, 3000)
      } catch {
        setError("Quick check-in failed. Please try again.")
        setShowQuickRepeat(false)
        setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
      } finally {
        setQuickRepeatProcessing(false)
      }
      return
    }

    // Card path — create a Stripe session and show QR within the overlay
    const baseAmountCentsCard = lastPurchasePattern?.amount ?? 0
    if (baseAmountCentsCard <= 0) {
      setError("Unable to determine amount for card payment.")
      setQuickRepeatProcessing(false)
      return
    }

    setQuickRepeatQrCheckout({ ...createEmptyKioskQrCheckoutState(), phase: "creating" })

    try {
      const consecutiveOfferForCard = consecutiveAccepted ? (bootstrap.consecutiveOffer ?? null) : null
      const consecutivePriceCents = consecutiveOfferForCard
        ? (consecutiveOfferForCard.dropInConsecutiveCents ?? null)
        : null
      const totalAmountCents = baseAmountCentsCard + (consecutivePriceCents ?? 0)

      const sessionPayload: Record<string, unknown> = {
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
        ...(kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        ...(consecutiveOfferForCard && consecutivePriceCents != null
          ? {
              consecutivePriceCents,
              consecutiveLinkedCourseSlug: consecutiveOfferForCard.linkedCourseSlug,
              consecutiveCourseTitle: consecutiveOfferForCard.linkedCourseTitle,
              consecutiveLinkedCourseTime: consecutiveOfferForCard.linkedCourseTime ?? context.time,
            }
          : {}),
      }

      const { res, data } = await requestCheckoutSessionApi({ payload: sessionPayload })

      if (!res.ok || typeof data?.url !== "string" || typeof data?.sessionId !== "string") {
        const message = typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "Error starting card checkout."
        setQuickRepeatQrCheckout({ ...createEmptyKioskQrCheckoutState(), phase: "error", error: message })
        setQuickRepeatProcessing(false)
        return
      }

      setQuickRepeatQrCheckout({
        phase: "qr_ready",
        sessionId: data.sessionId,
        url: data.url,
        expiresAt: data.expiresAt ?? null,
        awaitingWebhook: false,
        purchaseId: null,
        paymentStatus: null,
        error: null,
      })
    } catch {
      setQuickRepeatQrCheckout({
        ...createEmptyKioskQrCheckoutState(),
        phase: "error",
        error: "Unable to start card checkout.",
      })
    } finally {
      setQuickRepeatProcessing(false)
    }
  }, [bootstrap, kioskPinSessionToken, handleStationCompletionFromRef, setError])

  // ─── Poll quick-repeat QR checkout status ──────────────────
  const handleQuickRepeatQrComplete = React.useCallback(() => {
    setQuickRepeatSuccessChannel("card")
    setQuickRepeatSuccess(true)
    setTimeout(() => {
      setShowQuickRepeat(false)
      setQuickRepeatSuccess(false)
      setQuickRepeatSuccessChannel(null)
      setQuickRepeatQrCheckout(createEmptyKioskQrCheckoutState())
      void handleStationCompletionFromRef()
    }, 3000)
  }, [handleStationCompletionFromRef])

  useKioskQrCheckoutPoller({
    checkoutState: quickRepeatQrCheckout,
    setCheckoutState: setQuickRepeatQrCheckout,
    onComplete: handleQuickRepeatQrComplete,
  })

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
    packageCheckInAttempts,
    packageCheckInFailure,
    retryBackoffActive,
    setPackageCheckInFailure,
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
    kioskPinPanelCopy: { title: "Enter your phone number", description: "Enter your 10-digit US phone number to continue." },
    hasKioskPinSession,
    kioskPinAttemptsRemaining,
    kioskPinThrottleSeverity,
    kioskPinBlockedUntil,
    kioskPhone,
    kioskPhoneLoading,
    onKioskPhoneIdentify: handleKioskPhoneIdentify,
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
    packageCheckInFailure,
    showPackageCheckInFailureOverlay,
    packageCheckInAttempts,
    onRetryPackageCheckIn: handleRetryPackageCheckIn,
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
    showQuickRepeat,
    quickRepeatQrCheckout,
    quickRepeatProcessing,
    quickRepeatSuccess,
    quickRepeatSuccessChannel,
    onQuickRepeatConfirm: handleQuickRepeatConfirm,
    onQuickRepeatDecline: handleQuickRepeatDecline,
  })
}
