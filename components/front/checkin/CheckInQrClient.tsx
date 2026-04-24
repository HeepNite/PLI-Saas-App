"use client"

import React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { demoCourses } from "@/constants/courses"
import EnrollModal from "@/components/front/courses/EnrollModal"
import { toE164Phone } from "@/components/front/courses/utils/phone"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import {
  getExistingCustomerInitialStep,
  shouldAutoOpenExistingPurchase,
  shouldAutoTriggerPackageCheckIn,
  shouldPreserveOfferOnBootstrapClear,
  resolvePackageOfferDeclineAction,
} from "@/lib/checkin/existing-customer-flow"
import {
  resolvePackageOfferScenario,
  buildPackageOfferContext,
  pickEnrollPrefill,
} from "@/lib/checkin/package-offer-integration"
// KioskPackageOfferScreen removed - packages step is now in EnrollModal
import { useKioskCustomerSession } from "@/components/front/checkin/useKioskCustomerSession"
import { useKioskFlowCompletion } from "@/components/front/checkin/useKioskFlowCompletion"
import { useKioskPinFlow } from "@/components/front/checkin/useKioskPinFlow"
import {
  KioskResolvingOverlay,
  KioskPackageSuccessOverlay,
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
import {
  toEsDateTime,
  parseDuration,
  TRANSIENT_MESSAGE_TIMEOUT_MS,
} from "@/lib/checkin/checkin-helpers"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { useCheckInDisplayData } from "@/components/front/checkin/useCheckInDisplayData"
import type { EntryMode, BootstrapResponse, CheckInQrClientProps, PackageOfferContext } from "@/components/front/checkin/checkin.types"

export default function CheckInQrClient({
  forcedDeviceMode,
  forcedCourseSlug = "",
  hideQrPanel = false,
  shellVariant = "qr",
  terminalName,
  terminalLocation,
  qrPathOverride,
}: CheckInQrClientProps) {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, sessionId: activeSessionId } = useAuth()
  const clerk = useClerk()
  const [nowTick, setNowTick] = React.useState<Date>(() => new Date())
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
  const [showPhoneSignIn, setShowPhoneSignIn] = React.useState(false)
  const [pendingLoginPhone, setPendingLoginPhone] = React.useState("")
  const [loadingBootstrap, setLoadingBootstrap] = React.useState(false)
  const [bootstrap, setBootstrap] = React.useState<BootstrapResponse | null>(null)
  const [existingRegularBookingOverride, setExistingRegularBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [existingRegularBookingKey, setExistingRegularBookingKey] = React.useState(0)
  const [paymentsModalReady, setPaymentsModalReady] = React.useState(false)
  const [processingPackageCheckIn, setProcessingPackageCheckIn] = React.useState(false)
  const [packageCheckInResult, setPackageCheckInResult] = React.useState<{
    remainingCredits: number | null
    points: number
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [packageOfferContext, setPackageOfferContext] = React.useState<PackageOfferContext>(null)
  const [packageOfferSelectedId, setPackageOfferSelectedId] = React.useState<string | null>(null)
  const packageCheckInTimeoutRef = React.useRef<number | null>(null)

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
    setBootstrap,
    setError,
    setSuccess,
  })

  const {
    clearSuppressedClerkSessionId,
    hasActiveClerkSession,
    kioskClerkSessionId,
    registerKioskClerkSession,
    resetKioskCustomerSession,
    suppressClerkSessionOnCompletion,
  } = useKioskCustomerSession({
    activeSessionId,
    isKioskTerminalFlow,
    isSignedIn,
    user,
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
    stationRedirectUrl,
    entryMode,
    qrCourse,
    latePaymentRecommendation,
    activeCourseSlug,
    activeDate,
    activeTime,
    selectedCourse,
    contextIsValid,
    isStationDeviceFlow,
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
    showPackageOfferScreen,
  } = display

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
  const contextPayload = React.useMemo(
    () => ({ courseSlug: activeCourseSlug, date: activeDate, time: activeTime, durationMinutes }),
    [activeCourseSlug, activeDate, activeTime, durationMinutes]
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

  const signOutKioskCustomerSession = React.useCallback(
    // Don't pass redirectUrl to clerk.signOut - we handle redirect ourselves in completeKioskCustomerFlow
    // Passing redirectUrl causes Clerk to redirect before our code can run
    (sessionId: string) => clerk.signOut({ sessionId }),
    [clerk]
  )
  const replaceStationUrl = React.useCallback((url: string) => router.replace(url), [router])

  const { handleStationCompletion, dismissExistingCustomer: handleExistingCustomerDismiss } = useKioskFlowCompletion({
    isKioskTerminalFlow,
    kioskClerkSessionId,
    replaceUrl: replaceStationUrl,
    resetKioskCustomerSession,
    signOutKioskCustomerSession,
    stationRedirectUrl,
    suppressClerkSessionOnCompletion,
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
    setOpenNewBooking,
    setPaymentsModalReady,
    setPendingLoginPhone,
    setShowPhoneSignIn,
    setSuccess,
    setPackageOfferContext,
    setPackageOfferSelectedId,
  })

  // ─── API callbacks ──────────────────────────────────────────
  const loadBootstrap = React.useCallback(async () => {
    if (!contextIsValid) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) return
    if (!hasActiveClerkSession && kioskPinRotationRequired) return
    setLoadingBootstrap(true)
    setError(null)
    try {
      const token = await getToken({ skipCache: true })
      const res = await fetch("/api/checkin/qr/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          ...contextPayload,
          flowContext: photoFlowContext,
          ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setBootstrap(null)
        setError(typeof data?.error === "string" ? data.error : null)
        return
      }
      setBootstrap(data as BootstrapResponse)
    } catch {
      setBootstrap(null)
      setError(null)
    } finally {
      setLoadingBootstrap(false)
    }
  }, [contextIsValid, contextPayload, getToken, hasActiveClerkSession, kioskPinRotationRequired, kioskPinSessionToken, photoFlowContext])

  const completeStationPackageFlow = React.useCallback(() => {
    if (packageCheckInTimeoutRef.current !== null) {
      window.clearTimeout(packageCheckInTimeoutRef.current)
      packageCheckInTimeoutRef.current = null
    }
    void handleStationCompletion().finally(() => {
      setPackageCheckInResult(null)
    })
  }, [handleStationCompletion])

  const handlePackageCheckIn = React.useCallback(async () => {
    if (!bootstrap) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) {
      setError("Sign in first to complete package check-in.")
      return
    }
    if (!bootstrap.package) {
      setError("No active package available for this class.")
      return
    }
    if (!effectiveCheckInWindowOpen) {
      setError("The check-in window for this class is closed.")
      return
    }

    setProcessingPackageCheckIn(true)
    setError(null)
    setSuccess(null)

    try {
      const token = await getToken({ skipCache: true })
      const res = await fetch("/api/checkin/qr/package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
          durationMinutes: bootstrap.context.durationMinutes,
          flowContext: photoFlowContext,
          ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to check in with package.")
        return
      }

      const remainingCredits =
        data?.package && typeof data.package.remainingCredits === "number"
          ? data.package.remainingCredits
          : null
      const awardedPoints = typeof data?.points?.awarded === "number" ? data.points.awarded : 0
      const successParts = ["Package check-in completed."]
      if (remainingCredits !== null) {
        successParts.push(`Remaining credits: ${remainingCredits}.`)
      }
      if (awardedPoints > 0) {
        successParts.push(`Points earned: +${awardedPoints}.`)
      }

      if (isStationDeviceFlow) {
        if (packageCheckInTimeoutRef.current !== null) {
          window.clearTimeout(packageCheckInTimeoutRef.current)
          packageCheckInTimeoutRef.current = null
        }
        setPackageCheckInResult({ remainingCredits, points: awardedPoints })
        packageCheckInTimeoutRef.current = window.setTimeout(() => {
          packageCheckInTimeoutRef.current = null
          completeStationPackageFlow()
        }, 2500)
        return
      }

      setSuccess(successParts.join(" "))
      await loadBootstrap()
    } catch {
      setError("Unable to check in with package.")
    } finally {
      setProcessingPackageCheckIn(false)
    }
  }, [
    bootstrap,
    effectiveCheckInWindowOpen,
    getToken,
    hasActiveClerkSession,
    kioskPinSessionToken,
    isStationDeviceFlow,
    loadBootstrap,
    photoFlowContext,
    completeStationPackageFlow,
  ])

  const handlePackageSuccessDone = React.useCallback(() => {
    completeStationPackageFlow()
  }, [completeStationPackageFlow])

  React.useEffect(() => {
    return () => {
      if (packageCheckInTimeoutRef.current !== null) {
        window.clearTimeout(packageCheckInTimeoutRef.current)
        packageCheckInTimeoutRef.current = null
      }
    }
  }, [])

  // ─── UI handlers ────────────────────────────────────────────
  const handleExistingClick = React.useCallback(() => {
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
  }, [contextIsValid, hasActiveClerkSession, isKioskTerminalFlow, loadBootstrap, resetKioskPinFlow, selectedCourse])

  const handleNewClick = React.useCallback(() => {
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
    setOpenNewBooking(true)
  }, [activeDate, activeTime, contextIsValid, selectedCourse])

  const handleLatePaymentTablet = React.useCallback(() => {
    if (!latePaymentRecommendation) return
    setError(null)
    setSuccess(null)
    setBootstrap(null)
    setMode("idle")
  }, [latePaymentRecommendation])

  const handleLatePaymentPhone = React.useCallback(() => {
    if (!display.latePaymentQrLink || typeof window === "undefined") return
    window.open(display.latePaymentQrLink, "_blank", "noopener,noreferrer")
  }, [display.latePaymentQrLink])

  const handlePhoneSignInSuccess = React.useCallback(async () => {
    clearSuppressedClerkSessionId()
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    setBootstrap(null)
  }, [clearSuppressedClerkSessionId])

  const handlePhoneSignInSession = React.useCallback(async (sessionId: string) => {
    registerKioskClerkSession(sessionId)
  }, [registerKioskClerkSession])

  const handleSwitchAccount = React.useCallback(() => {
    void clerk.signOut({
      redirectUrl: forceRedirectUrl,
      ...(activeSessionId ? { sessionId: activeSessionId } : {}),
    })
  }, [activeSessionId, clerk, forceRedirectUrl])

  const openExistingPurchaseFlow = React.useCallback((context: { courseSlug: string; date: string; time: string }) => {
    setError(null)
    setSuccess(null)
    setPaymentsModalReady(false)
    setExistingRegularBookingKey((prev) => prev + 1)
    setExistingRegularBookingOverride(context)
  }, [])

  const fetchPreviousPackage = React.useCallback(async ({ userId, courseSlug }: { userId: string; courseSlug: string }) => {
    const token = await getToken({ skipCache: true })
    const res = await fetch("/api/checkin/previous-package", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ customerUserId: userId, courseSlug }),
    })
    if (!res.ok) throw new Error(`previous-package endpoint returned ${res.status}`)
    const data = await res.json().catch(() => null)
    return data?.previousPackageId ?? null
  }, [getToken])

  const handlePackageOfferSelect = React.useCallback((packageId: string) => {
    const ctx = packageOfferContext
    if (!ctx) return
    setPackageOfferContext(null)

    // Existing user flow only (new users select packages in EnrollModal)
    setPackageOfferSelectedId(packageId)
    openExistingPurchaseFlow({
      courseSlug: ctx.courseSlug,
      date: ctx.date,
      time: ctx.time,
    })
  }, [packageOfferContext, openExistingPurchaseFlow])

  const handlePackageOfferDecline = React.useCallback(() => {
    const action = resolvePackageOfferDeclineAction(packageOfferContext?.scenario ?? null)
    setPackageOfferContext(null)

    if (action === "station-completion") {
      void handleStationCompletion()
      return
    }
    if (bootstrap) {
      openExistingPurchaseFlow({
        courseSlug: bootstrap.context.courseSlug,
        date: bootstrap.context.date,
        time: bootstrap.context.time,
      })
    }
  }, [bootstrap, handleStationCompletion, openExistingPurchaseFlow, packageOfferContext?.scenario])

  const handlePackageOfferTimeout = React.useCallback(() => {
    setPackageOfferContext(null)
    void handleStationCompletion()
  }, [handleStationCompletion])

  const [returnedFromNewStudentFlow, setReturnedFromNewStudentFlow] = React.useState(false)

  const handleExistingUserDetected = React.useCallback(() => {
    setOpenNewBooking(false)
    setReturnedFromNewStudentFlow(true)
    setMode("existing")
  }, [])

  // Clear the "returned from new student" flag when leaving existing mode
  React.useEffect(() => {
    if (mode !== "existing") setReturnedFromNewStudentFlow(false)
  }, [mode])

  const handleNewUserPostPurchase = React.useCallback(() => {
    // After new-student purchase, reset immediately.
    // The EnrollModal handles its own 10s auto-reset timeout, but when
    // the user explicitly presses Finish, we should complete immediately.
    void handleStationCompletion()
  }, [handleStationCompletion])

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
    setMode("idle")
  }, [])

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
    if (entryMode === "existing" && mode !== "existing") {
      setMode("existing")
      return
    }
    if (hasActiveClerkSession && mode === "idle") {
      setMode("existing")
    }
  }, [entryMode, hasActiveClerkSession, mode])

  React.useEffect(() => {
    if (!hasActiveClerkSession) return
    if (showPhoneSignIn) {
      setShowPhoneSignIn(false)
    }
  }, [hasActiveClerkSession, showPhoneSignIn])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNowTick(new Date()), 30_000)
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
    existingRegularBookingOverride,
    hasActiveClerkSession,
    hasKioskPinSession,
    isKioskTerminalFlow,
    loadingBootstrap,
    mode,
    openExistingPurchaseFlow,
    openNewBooking,
    processingPackageCheckIn,
  ])



  // Auto-trigger package check-in on kiosk: PIN identify → bootstrap with package → deduct immediately
  React.useEffect(() => {
    if (
      !shouldAutoTriggerPackageCheckIn({
        isKioskTerminalFlow,
        mode,
        hasPackage: Boolean(bootstrap?.package),
        processingPackageCheckIn,
        hasPackageCheckInResult: Boolean(packageCheckInResult),
        effectiveCheckInWindowOpen,
        hasActiveSession: hasActiveClerkSession || hasKioskPinSession,
      })
    ) {
      return
    }
    void handlePackageCheckIn()
  }, [
    bootstrap,
    effectiveCheckInWindowOpen,
    handlePackageCheckIn,
    hasActiveClerkSession,
    hasKioskPinSession,
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

  // ─── Render ─────────────────────────────────────────────────
  const isTerminal = shellVariant === "terminal"

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

          <div className={`${isTerminal ? "mt-3 min-h-0 overflow-hidden" : "mt-6"} flex flex-1 flex-col justify-center`}>
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
            {showQrPanel && <QrPromptText variant={shellVariant === "terminal" ? "terminal" : "personal"} />}

            {showContextWarning && <ContextWarning />}

            {showLatePaymentOffer && (
              <LatePaymentPanel
                courseTitle={latePaymentCourse?.title || "Previous class"}
                date={latePaymentRecommendation?.date || ""}
                time={latePaymentRecommendation?.time || ""}
                qrImage={latePaymentQrImage}
                onUseTablet={handleLatePaymentTablet}
                onOpenPhone={handleLatePaymentPhone}
              />
            )}

            {!hideEntrySelection && (
              <EntrySelectionButtons
                mode={mode}
                isKioskTerminalFlow={isKioskTerminalFlow}
                onExisting={handleExistingClick}
                onNew={handleNewClick}
              />
            )}

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
                blockedUntilLabel={kioskPinBlockedUntil ? `This terminal is temporarily blocked until ${toEsDateTime(kioskPinBlockedUntil)}.` : null}
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

      {showKioskResolvingOverlay && !packageCheckInResult && (
        <KioskResolvingOverlay
          message={processingPackageCheckIn ? "Checking you in\u2026" : undefined}
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
            // User has active package if bootstrap.package exists
            hasActivePackage: Boolean(bootstrap?.package),
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
          onCompletedAction={isKioskTerminalFlow ? handleStationCompletion : undefined}
          prefillContact={bootstrapContact || undefined}
        />
      )}
    </main>
  )
}
