import React from "react"
import { homeCourses } from "@/constants/home-content"
import {
  pickWalkInRecommendation,
  pickLatePaymentRecommendation,
  pickTerminalContextRecommendation,
  normalizeCustomerNameParts,
  getCourseDurationMinutes,
  toCategoryLabel,
} from "@/lib/checkin/checkin-helpers"
import {
  hasExistingCustomerPrefillContact,
  shouldShowCheckInQrPanel,
} from "@/lib/checkin/existing-customer-flow"
import { shouldShowKioskResolvingOverlay } from "@/lib/checkin/kiosk-qr-payment"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import type { BootstrapResponse, PackageOfferContext } from "@/components/front/checkin/checkin.types"
import type { CourseData } from "@/constants/courses"

type UseCheckInDisplayDataArgs = {
  sourceCourses: CourseData[]
  shellVariant: "qr" | "terminal"
  hideQrPanel: boolean
  qrPathOverride?: string
  pathname: string
  searchParams: URLSearchParams
  forcedDeviceMode?: "station" | "personal"
  forcedCourseSlug: string
  nowTick: Date
  origin: string
  isCompactViewport: boolean
  mode: "idle" | "existing" | "new"
  hasActiveClerkSession: boolean
  hasKioskPinSession: boolean
  kioskPinRotationRequired: boolean
  loadingBootstrap: boolean
  bootstrap: BootstrapResponse | null
  visibleError: string | null
  paymentsModalReady: boolean
  existingRegularBookingOverride: { courseSlug: string; date: string; time: string } | null
  openNewBooking: boolean
  processingPackageCheckIn: boolean
  packageOfferContext: PackageOfferContext
}

export function useCheckInDisplayData(args: UseCheckInDisplayDataArgs) {
  const {
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
  } = args

  // ─── URL params ─────────────────────────────────────────────
  const qrCourseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()
  const qrDate = (searchParams.get("date") || "").trim()
  const qrTime = (searchParams.get("time") || "").trim()
  const qrView = (searchParams.get("fromQr") || searchParams.get("scan") || "").trim().toLowerCase()
  const deviceMode = (searchParams.get("device") || searchParams.get("terminal") || "").trim().toLowerCase()
  const preferredCourseSlug = forcedCourseSlug.trim().toLowerCase()
  const baseCourseSlug = qrCourseSlug || preferredCourseSlug
  const hasExplicitContext = Boolean(qrCourseSlug && qrDate && qrTime)

  // ─── Recommendations ────────────────────────────────────────
  const qrCourse = React.useMemo(
    () => sourceCourses.find((course) => course.slug === baseCourseSlug) || null,
    [baseCourseSlug, sourceCourses]
  )

  const latePaymentRecommendation = React.useMemo(
    () => (shellVariant === "terminal" && !hasExplicitContext ? pickLatePaymentRecommendation(sourceCourses, nowTick) : null),
    [hasExplicitContext, nowTick, shellVariant, sourceCourses]
  )

  const walkInRecommendation = React.useMemo(
    () => pickWalkInRecommendation(sourceCourses, nowTick, baseCourseSlug),
    [baseCourseSlug, nowTick, sourceCourses]
  )

  const fixedContextRecommendation = React.useMemo(
    () =>
      hasExplicitContext
        ? { courseSlug: qrCourseSlug, date: qrDate, time: qrTime }
        : shellVariant === "terminal"
          ? pickTerminalContextRecommendation(sourceCourses, nowTick, preferredCourseSlug)
        : null,
    [hasExplicitContext, nowTick, preferredCourseSlug, qrCourseSlug, qrDate, qrTime, shellVariant, sourceCourses]
  )

  const activeCourseSlug = fixedContextRecommendation?.courseSlug || baseCourseSlug
  const activeDate = fixedContextRecommendation?.date || qrDate
  const activeTime = fixedContextRecommendation?.time || qrTime
  const selectedCourse = React.useMemo(
    () => sourceCourses.find((course) => course.slug === activeCourseSlug) || null,
    [activeCourseSlug, sourceCourses]
  )
  const contextIsValid = Boolean(activeCourseSlug && activeDate && activeTime)

  // ─── URLs ───────────────────────────────────────────────────
  const forceRedirectUrl = React.useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  const stationRedirectUrl = React.useMemo(() => {
    // For kiosk terminal flow, redirect to /staff/log-in to restart the flow
    // This preserves qr=true so the terminal mode stays active
    if (shellVariant === "terminal") {
      const params = new URLSearchParams()
      const qrValue = searchParams.get("qr")
      if (qrValue) params.set("qr", qrValue)
      const query = params.toString()
      return query ? `/staff/log-in?${query}` : "/staff/log-in"
    }
    // For other flows, stay on the same page but clear entry params
    const params = new URLSearchParams(searchParams.toString())
    params.delete("entry")
    params.delete("fromQr")
    params.delete("scan")
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams, shellVariant])

  const entryMode = (searchParams.get("entry") || "").trim().toLowerCase()

  // ─── Device / flow detection ────────────────────────────────
  const isQrEntry = qrView === "1" || qrView === "true"
  const photoFlowContext = React.useMemo(
    () => resolvePhotoFlowContext({ shellVariant, isQrEntry }),
    [isQrEntry, shellVariant]
  )
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"
  const isExplicitStationDevice =
    forcedDeviceMode === "station" ||
    deviceMode === "station" ||
    deviceMode === "local" ||
    deviceMode === "terminal"
  const isPersonalForced = forcedDeviceMode === "personal"
  const isStationDeviceFlow = isPersonalForced ? false : isExplicitStationDevice || (!isQrEntry && !isCompactViewport)
  const completionMode = isStationDeviceFlow ? "station" as const : "personal" as const

  // ─── Check-in display course ────────────────────────────────
  const checkInDisplayCourse = selectedCourse || qrCourse
  const qrPath = qrPathOverride?.trim() || pathname

  const currentHomeCourse = React.useMemo(
    () =>
      homeCourses.find((course) => course.slug === (checkInDisplayCourse?.slug || "")) ||
      homeCourses.find((course) => course.slug === activeCourseSlug) ||
      null,
    [activeCourseSlug, checkInDisplayCourse?.slug]
  )

  const checkInCardImage =
    currentHomeCourse?.image ||
    checkInDisplayCourse?.heroMedia?.image ||
    checkInDisplayCourse?.instructors?.[0]?.photo ||
    "/images/hero-menu/live-academy.JPG"
  const checkInCardTeacher =
    currentHomeCourse?.teacher ||
    checkInDisplayCourse?.instructors?.map((item) => item.name).filter(Boolean).join(" / ") ||
    "PLI Team"
  const checkInCardDuration = currentHomeCourse?.duration || checkInDisplayCourse?.duration || "55 min"
  const checkInCardStudents =
    (typeof currentHomeCourse?.students === "string" && currentHomeCourse.students) ||
    (typeof currentHomeCourse?.students === "number" ? `${currentHomeCourse.students}` : "") ||
    "Groups reducidos"
  const checkInCardBadge = currentHomeCourse?.badge || "Check-in presencial"
  const checkInCardCategory = currentHomeCourse?.category || toCategoryLabel(checkInDisplayCourse?.slug || activeCourseSlug)
  const checkInCardDescription =
    currentHomeCourse?.description ||
    checkInDisplayCourse?.description ||
    "Class activa en el establecimiento."

  // ─── QR links ───────────────────────────────────────────────
  const checkInQrLink = React.useMemo(() => {
    if (!origin || !contextIsValid) return ""
    const params = new URLSearchParams()
    params.set("courseSlug", activeCourseSlug)
    params.set("date", activeDate)
    params.set("time", activeTime)
    params.set("durationMinutes", String(60))
    params.set("fromQr", "1")
    return `${origin}${qrPath}?${params.toString()}`
  }, [activeCourseSlug, activeDate, activeTime, contextIsValid, origin, qrPath])

  const checkInQrImage = React.useMemo(() => {
    if (!checkInQrLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(checkInQrLink)}`
  }, [checkInQrLink])

  // ─── Bootstrap card data ────────────────────────────────────
  const bootstrapCourse = React.useMemo(
    () => sourceCourses.find((course) => course.slug === (bootstrap?.context.courseSlug || "")) || selectedCourse || qrCourse || null,
    [bootstrap?.context.courseSlug, qrCourse, selectedCourse, sourceCourses]
  )
  const bootstrapHomeCourse = React.useMemo(
    () => homeCourses.find((course) => course.slug === (bootstrap?.context.courseSlug || "")) || currentHomeCourse || null,
    [bootstrap?.context.courseSlug, currentHomeCourse]
  )
  const bootstrapCourseImage =
    bootstrapHomeCourse?.image ||
    bootstrapCourse?.heroMedia?.image ||
    bootstrapCourse?.instructors?.[0]?.photo ||
    "/images/hero-menu/live-academy.JPG"
  const bootstrapCardCategory =
    bootstrapHomeCourse?.category || toCategoryLabel(bootstrap?.context.courseSlug || activeCourseSlug)
  const bootstrapCardBadge = bootstrapHomeCourse?.badge || "Check-in presencial"
  const bootstrapCardDuration = bootstrapHomeCourse?.duration || bootstrapCourse?.duration || "55 min"
  const bootstrapCardStudents =
    (typeof bootstrapHomeCourse?.students === "string" && bootstrapHomeCourse.students) ||
    (typeof bootstrapHomeCourse?.students === "number" ? `${bootstrapHomeCourse.students}` : "") ||
    "Groups reducidos"
  const bootstrapCardTeacher =
    bootstrapHomeCourse?.teacher ||
    bootstrapCourse?.instructors?.map((item) => item.name).filter(Boolean).join(" / ") ||
    "PLI Team"
  const bootstrapCardDescription =
    bootstrapHomeCourse?.description || bootstrapCourse?.description || "Class activa en el establecimiento."

  // ─── Bootstrap contact ──────────────────────────────────────
  const bootstrapContact = React.useMemo(() => {
    if (!bootstrap) return null
    const nameParts = normalizeCustomerNameParts(bootstrap.customer)
    return {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: bootstrap.customer.email,
      phone: bootstrap.customer.phone,
    }
  }, [bootstrap])
  const hasBootstrapPrefilledContact = hasExistingCustomerPrefillContact(bootstrapContact || undefined)

  // ─── Late payment ───────────────────────────────────────────
  const isLatePaymentContext = Boolean(
    latePaymentRecommendation &&
      activeCourseSlug === latePaymentRecommendation.courseSlug &&
      activeDate === latePaymentRecommendation.date &&
      activeTime === latePaymentRecommendation.time
  )
  const latePaymentCourse = React.useMemo(
    () =>
      latePaymentRecommendation
        ? sourceCourses.find((course) => course.slug === latePaymentRecommendation.courseSlug) || null
        : null,
    [latePaymentRecommendation, sourceCourses]
  )
  const latePaymentQrLink = React.useMemo(() => {
    if (!origin || !latePaymentRecommendation) return ""
    const params = new URLSearchParams()
    params.set("courseSlug", latePaymentRecommendation.courseSlug)
    params.set("date", latePaymentRecommendation.date)
    params.set("time", latePaymentRecommendation.time)
    params.set(
      "durationMinutes",
      String(getCourseDurationMinutes(latePaymentRecommendation.courseSlug, sourceCourses, 60))
    )
    params.set("fromQr", "1")
    return `${origin}${qrPath}?${params.toString()}`
  }, [latePaymentRecommendation, origin, qrPath, sourceCourses])
  const latePaymentQrImage = React.useMemo(() => {
    if (!latePaymentQrLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=${encodeURIComponent(latePaymentQrLink)}`
  }, [latePaymentQrLink])

  // ─── Package offer ──────────────────────────────────────
  const showPackageOfferScreen = packageOfferContext !== null

  // ─── Visibility flags ───────────────────────────────────────
  const showQrPanel = shouldShowCheckInQrPanel({
    hideQrPanel,
    hasQrImage: Boolean(checkInQrImage),
    isCompactViewport,
    isQrEntry,
    shellVariant,
  })
  const effectiveClerkSession = hasActiveClerkSession && !isKioskTerminalFlow
  const showSignedInBootstrapPanel = mode === "existing" && (effectiveClerkSession || hasKioskPinSession)
  const showKioskPinPanel =
    mode === "existing" && isKioskTerminalFlow && (!hasKioskPinSession || kioskPinRotationRequired)
  const hideEntrySelection = showSignedInBootstrapPanel || showKioskPinPanel
  const showCourseCardPanel = Boolean(checkInDisplayCourse || currentHomeCourse) && !showSignedInBootstrapPanel
  const showLatePaymentOffer = Boolean(
    shellVariant === "terminal" &&
      latePaymentRecommendation &&
      latePaymentCourse &&
      latePaymentQrImage &&
      !isLatePaymentContext
  )
  const legacyContextMissing = !qrCourseSlug || !qrDate || !qrTime
  const showContextWarning = shellVariant === "qr" && !contextIsValid && legacyContextMissing
  const showKioskResolvingOverlay = shouldShowKioskResolvingOverlay({
    isKioskTerminalFlow,
    mode,
    hasActiveCustomerSession: Boolean(hasActiveClerkSession || hasKioskPinSession),
    hasPendingPinRotation: kioskPinRotationRequired,
    loadingBootstrap,
    hasBootstrap: Boolean(bootstrap),
    hasPackage: Boolean(bootstrap?.package),
    processingPackageCheckIn,
    hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
    hasVisibleError: Boolean(visibleError),
    hasPackageOffer: showPackageOfferScreen,
    paymentsStepReady: paymentsModalReady,
    hasExistingPurchaseForSession: Boolean(bootstrap?.hasExistingPurchaseForSession),
  })

  // ─── Breadcrumbs ────────────────────────────────────────────
  const breadcrumbItems = React.useMemo(() => {
    const items = [shellVariant === "terminal" ? "Terminal" : "QR check-in"]
    if (mode === "new") {
      items.push("I am new")
      if (openNewBooking) items.push("Purchase")
      return items
    }
    if (mode === "existing") {
      items.push("Existing customer")
      if (showKioskPinPanel && !hasKioskPinSession) {
        items.push("Enter PIN")
        return items
      }
      if (showKioskPinPanel && kioskPinRotationRequired) {
        items.push("Rotate PIN")
        return items
      }
      if (!hasActiveClerkSession && !hasKioskPinSession) {
        items.push("Sign in")
        return items
      }
      if (loadingBootstrap) {
        items.push("Loading")
        return items
      }
      items.push("Current course")
      if (bootstrap?.quickCheckout) {
        items.push("Repurchase")
      } else if (existingRegularBookingOverride) {
        items.push("Regular purchase")
      }
      if (showPackageOfferScreen) {
        items.push("Package offer")
      }
    }
    return items
  }, [
    bootstrap?.quickCheckout,
    existingRegularBookingOverride,
    hasActiveClerkSession,
    hasKioskPinSession,
    kioskPinRotationRequired,
    loadingBootstrap,
    mode,
    openNewBooking,
    shellVariant,
    showKioskPinPanel,
    showPackageOfferScreen,
  ])

  // ─── Misc labels ────────────────────────────────────────────
  const welcomeLabel = bootstrap?.customer.firstName || bootstrap?.customer.name || "student"
  const shellEyebrow = "QR Check-in"
  const mainSpacingClass = shellVariant === "terminal" ? "pt-4 pb-4 sm:pt-6 sm:pb-6" : "py-6 sm:py-10"
  const checkInDisplayDate = activeDate
  const checkInDisplayTime = activeTime
  const effectiveCheckInWindowOpen = Boolean(bootstrap?.context.checkInWindow.isOpen)

  // ─── Quick checkout details ─────────────────────────────────
  const quickCheckoutDetails = React.useMemo(() => {
    const quickCheckout = bootstrap?.quickCheckout
    if (!quickCheckout) return null
    const course = selectedCourse
    if (!course) return null
    const serviceLabel =
      course.enrollment.services.find((item) => item.id === quickCheckout.serviceId)?.label ||
      quickCheckout.serviceId
    const packageLabel = quickCheckout.packageId
      ? course.enrollment.packages.find((item) => item.id === quickCheckout.packageId)?.label ||
        quickCheckout.packageId
      : ""
    const addonLabels = (course.enrollment.addons || [])
      .filter((item) => quickCheckout.addons.includes(item.id))
      .map((item) => item.label)
    return { serviceLabel, packageLabel, addonLabels }
  }, [bootstrap?.quickCheckout, selectedCourse])

  return {
    // URL / routing
    forceRedirectUrl,
    stationRedirectUrl,
    entryMode,
    qrPath,

    // Recommendations
    qrCourse,
    latePaymentRecommendation,
    walkInRecommendation,
    fixedContextRecommendation,
    activeCourseSlug,
    activeDate,
    activeTime,
    selectedCourse,
    contextIsValid,

    // Flow detection
    isQrEntry,
    photoFlowContext,
    isKioskTerminalFlow,
    isStationDeviceFlow,
    completionMode,

    // Check-in card
    checkInDisplayCourse,
    currentHomeCourse,
    checkInCardImage,
    checkInCardTeacher,
    checkInCardDuration,
    checkInCardStudents,
    checkInCardBadge,
    checkInCardCategory,
    checkInCardDescription,
    checkInQrLink,
    checkInQrImage,

    // Bootstrap card
    bootstrapCourse,
    bootstrapHomeCourse,
    bootstrapCourseImage,
    bootstrapCardCategory,
    bootstrapCardBadge,
    bootstrapCardDuration,
    bootstrapCardStudents,
    bootstrapCardTeacher,
    bootstrapCardDescription,
    bootstrapContact,
    hasBootstrapPrefilledContact,

    // Late payment
    isLatePaymentContext,
    latePaymentCourse,
    latePaymentQrLink,
    latePaymentQrImage,

    // Visibility
    showQrPanel,
    showSignedInBootstrapPanel,
    showKioskPinPanel,
    hideEntrySelection,
    showCourseCardPanel,
    showLatePaymentOffer,
    showContextWarning,
    showKioskResolvingOverlay,
    showPackageOfferScreen,

    // Labels / misc
    welcomeLabel,
    shellEyebrow,
    mainSpacingClass,
    checkInDisplayDate,
    checkInDisplayTime,
    effectiveCheckInWindowOpen,
    breadcrumbItems,
    quickCheckoutDetails,
  }
}
