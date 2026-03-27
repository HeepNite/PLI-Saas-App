"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"
import { homeCourses } from "@/constants/home-content"
import EnrollModal from "@/components/front/courses/EnrollModal"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import { buildSessionStartsAt, getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { toE164Phone } from "@/components/front/courses/utils/phone"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { getExistingCustomerInitialStep, shouldShowCheckInQrPanel } from "@/lib/checkin/existing-customer-flow"
import { shouldShowKioskResolvingOverlay } from "@/lib/checkin/kiosk-qr-payment"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"

type EntryMode = "idle" | "existing" | "new"

type BootstrapResponse = {
  context: {
    courseSlug: string
    courseTitle: string
    date: string
    time: string
    durationMinutes: number
    startsAt: string
    endsAt: string
    checkInWindow: {
      isOpen: boolean
      opensAt: string
      closesAt: string
    }
  }
  customer: {
    userId: string
    clerkUserId: string
    firstName: string
    lastName: string
    name: string
    email: string
    phone: string
    hasAvatar: boolean
  }
  package: {
    id: string
    packageId: string
    packageLabel: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: string | null
    status: string
  } | null
  packages: Array<{
    id: string
    packageId: string
    packageLabel: string | null
    courseSlug: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: string | null
    status: string
  }>
  quickCheckout: {
    serviceId: string
    packageId: string
    addons: string[]
    participants: number
    coupon: string
    amountCents: number
    currency: string
    sourcePurchaseId: string | null
    sourcePurchaseAt: string | null
  } | null
  purchaseHistory: Array<{
    id: string
    createdAt: string
    amount: number
    currency: string
    status: string
    participants: number | null
    serviceId: string
    packageId: string
    addons: string[]
    date: string
    time: string
  }>
  hasPreviousPurchase: boolean
  hasAnyCompletedPurchase: boolean
}

type KioskPinIdentifySuccess = {
  identified: true
  credentialKind: "permanent" | "provisional"
  requiresPinRotation: boolean
  requiresPinRegeneration?: boolean
  regenerationReason?: "obsolete"
  sessionToken: string
  sessionExpiresAt: string
}

type KioskPinIdentifyFailure = {
  identified: false
  terminalBlocked?: boolean
  blockedUntil?: string | null
  attemptsRemaining?: number
  requiresPinRegeneration?: boolean
  reason?: string
  message?: string
}

type KioskPinIdentifyError = {
  error?: string
  message?: string
  blockedUntil?: string | null
  attemptsRemaining?: number
  requiresPinRegeneration?: boolean
}

const parseDuration = (value: string | null) => {
  if (!value) return 60
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 60
  return Math.max(15, Math.min(240, parsed))
}

const CHECKIN_TIME_ZONE = "America/New_York"
const WALK_IN_LATE_GRACE_MINUTES = 30
const TERMINAL_LATE_PAYMENT_AFTER_END_MINUTES = 10
const TERMINAL_LATE_PAYMENT_NEXT_CLASS_MAX_GAP_MINUTES = 120
const PIN_LAST_DIGIT_REVEAL_MS = 700

const pad = (value: number) => String(value).padStart(2, "0")

const toMinutes = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const sortTimes = (times: string[]) =>
  [...new Set(times.filter((value) => /^\d{2}:\d{2}$/.test(value)))].sort(
    (a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0)
  )

const shiftIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

const getCourseFamilyKey = (courseSlug: string) => {
  const [family] = courseSlug.split("-")
  return family?.trim().toLowerCase() || ""
}

const toCategoryLabel = (courseSlug: string) => {
  const key = getCourseFamilyKey(courseSlug)
  if (!key) return "Program"
  return key.charAt(0).toUpperCase() + key.slice(1)
}

const getCourseDurationMinutes = (courseSlug: string, courses: CourseData[], fallbackMinutes = 60) => {
  const course = courses.find((item) => item.slug === courseSlug)
  const match = course?.duration?.match(/(\d+)/)
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (!Number.isFinite(parsed)) return fallbackMinutes
  return Math.max(15, Math.min(240, parsed))
}

const pickWalkInRecommendation = (courses: CourseData[], referenceDate = new Date(), preferredCourseSlug = "") => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null as null | { courseSlug: string; date: string; time: string }
  const nowMinutes = toMinutes(getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE))

  const preferredFamily = getCourseFamilyKey(preferredCourseSlug)

  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const dateIso = shiftIsoDate(todayIso, dayOffset)
    let bestForDay: null | { courseSlug: string; date: string; time: string; minutes: number; preferred: boolean } = null

    for (const course of courses) {
      const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, dateIso, courses))
      for (const slot of slots) {
        const slotMinutes = toMinutes(slot)
        if (slotMinutes === null) continue
        if (dayOffset === 0 && nowMinutes !== null && nowMinutes > slotMinutes + WALK_IN_LATE_GRACE_MINUTES) {
          continue
        }

        const isPreferred = preferredFamily
          ? getCourseFamilyKey(course.slug) === preferredFamily
          : false

        if (
          !bestForDay ||
          slotMinutes < bestForDay.minutes ||
          (slotMinutes === bestForDay.minutes && isPreferred && !bestForDay.preferred)
        ) {
          bestForDay = {
            courseSlug: course.slug,
            date: dateIso,
            time: slot,
            minutes: slotMinutes,
            preferred: isPreferred,
          }
        }
      }
    }

    if (bestForDay) {
      return {
        courseSlug: bestForDay.courseSlug,
        date: bestForDay.date,
        time: bestForDay.time,
      }
    }
  }

  return null
}

const pickLatePaymentRecommendation = (courses: CourseData[], referenceDate = new Date()) => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null as null | { courseSlug: string; date: string; time: string }
  const nowMs = referenceDate.getTime()
  let bestMatch: null | { courseSlug: string; date: string; time: string; startsAtMs: number } = null
  const todaySlots: Array<{ courseSlug: string; time: string; startsAtMs: number; endsAtMs: number }> = []

  for (const course of courses) {
    const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, todayIso, courses))
    const durationMinutes = getCourseDurationMinutes(course.slug, courses)
    for (const slot of slots) {
      const startsAt = buildSessionStartsAt(todayIso, slot)
      if (!startsAt) continue
      const startsAtMs = startsAt.getTime()
      const endsAtMs = startsAtMs + durationMinutes * 60 * 1000
      todaySlots.push({
        courseSlug: course.slug,
        time: slot,
        startsAtMs,
        endsAtMs,
      })
    }
  }

  todaySlots.sort((a, b) => a.startsAtMs - b.startsAtMs)

  for (let index = 0; index < todaySlots.length; index += 1) {
    const slot = todaySlots[index]
    const latePaymentOpensAtMs = slot.endsAtMs
    const latePaymentClosesAtMs = slot.endsAtMs + TERMINAL_LATE_PAYMENT_AFTER_END_MINUTES * 60 * 1000
    if (nowMs < latePaymentOpensAtMs || nowMs > latePaymentClosesAtMs) continue

    const nextSlot = todaySlots[index + 1] || null
    if (nextSlot) {
      const gapMinutes = Math.round((nextSlot.startsAtMs - slot.endsAtMs) / (60 * 1000))
      if (gapMinutes > TERMINAL_LATE_PAYMENT_NEXT_CLASS_MAX_GAP_MINUTES) {
        continue
      }
    }

    if (!bestMatch || slot.startsAtMs > bestMatch.startsAtMs) {
      bestMatch = {
        courseSlug: slot.courseSlug,
        date: todayIso,
        time: slot.time,
        startsAtMs: slot.startsAtMs,
      }
    }
  }

  if (!bestMatch) return null
  return {
    courseSlug: bestMatch.courseSlug,
    date: bestMatch.date,
    time: bestMatch.time,
  }
}

const toEsDateTime = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(parsed)
}

const formatMaskedPinDisplay = (value: string, revealedIndex: number | null) =>
  Array.from({ length: 4 }, (_, index) => {
    if (index >= value.length) return "-"
    if (revealedIndex === index) return value[index]
    return "*"
  }).join("")

export default function CheckInQrClient({
  forcedDeviceMode,
  forcedCourseSlug = "",
  hideQrPanel = false,
  shellVariant = "qr",
  qrPathOverride,
}: {
  forcedDeviceMode?: "station" | "personal"
  forcedCourseSlug?: string
  hideQrPanel?: boolean
  shellVariant?: "qr" | "terminal"
  terminalName?: string
  qrPathOverride?: string
}) {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useUser()
  const { getToken, sessionId: activeSessionId } = useAuth()
  const clerk = useClerk()
  const [nowTick, setNowTick] = React.useState<Date>(() => new Date())
  const [origin, setOrigin] = React.useState("")
  const [isCompactViewport, setIsCompactViewport] = React.useState(false)

  const qrCourseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()
  const qrDate = (searchParams.get("date") || "").trim()
  const qrTime = (searchParams.get("time") || "").trim()
  const qrView = (searchParams.get("fromQr") || searchParams.get("scan") || "").trim().toLowerCase()
  const deviceMode = (searchParams.get("device") || searchParams.get("terminal") || "").trim().toLowerCase()
  const preferredCourseSlug = forcedCourseSlug.trim().toLowerCase()
  const baseCourseSlug = qrCourseSlug || preferredCourseSlug
  const durationMinutes = parseDuration(searchParams.get("durationMinutes"))
  const hasExplicitContext = Boolean(qrCourseSlug && qrDate && qrTime)
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
        ? {
            courseSlug: qrCourseSlug,
            date: qrDate,
            time: qrTime,
          }
        : null,
    [hasExplicitContext, qrCourseSlug, qrDate, qrTime]
  )
  const [manualRecommendation, setManualRecommendation] = React.useState<null | {
    courseSlug: string
    date: string
    time: string
  }>(null)
  const activeRecommendation = fixedContextRecommendation || manualRecommendation || walkInRecommendation
  const activeCourseSlug = activeRecommendation?.courseSlug || baseCourseSlug
  const activeDate = activeRecommendation?.date || qrDate
  const activeTime = activeRecommendation?.time || qrTime
  const selectedCourse = React.useMemo(
    () => sourceCourses.find((course) => course.slug === activeCourseSlug) || null,
    [activeCourseSlug, sourceCourses]
  )
  const contextIsValid = Boolean(activeCourseSlug && activeDate && activeTime)
  const forceRedirectUrl = React.useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])
  const stationRedirectUrl = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("entry")
    params.delete("fromQr")
    params.delete("scan")
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])
  const entryMode = (searchParams.get("entry") || "").trim().toLowerCase()

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
  // True once the EnrollModal has reached the payments step and is ready to display.
  // Used to keep the kiosk resolving overlay up until payments is truly visible.
  const [paymentsModalReady, setPaymentsModalReady] = React.useState(false)
  const [processingPackageCheckIn, setProcessingPackageCheckIn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [kioskPin, setKioskPin] = React.useState("")
  const [kioskPinSessionToken, setKioskPinSessionToken] = React.useState("")
  const [kioskPinLoading, setKioskPinLoading] = React.useState(false)
  const [kioskPinRotationRequired, setKioskPinRotationRequired] = React.useState(false)
  const [kioskPinRotationMode, setKioskPinRotationMode] = React.useState<"provisional" | "regeneration" | null>(null)
  const [kioskPinNext, setKioskPinNext] = React.useState("")
  const [kioskPinConfirm, setKioskPinConfirm] = React.useState("")
  const [kioskPinRotating, setKioskPinRotating] = React.useState(false)
  const [kioskPinAttemptsRemaining, setKioskPinAttemptsRemaining] = React.useState<number | null>(null)
  const [kioskPinBlockedUntil, setKioskPinBlockedUntil] = React.useState<string | null>(null)
  const [pinReveal, setPinReveal] = React.useState<null | { field: "entry" | "next" | "confirm"; index: number }>(null)
  const pinRevealTimeoutRef = React.useRef<number | null>(null)
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

  const checkInDisplayCourse = selectedCourse || qrCourse
  const qrPath = qrPathOverride?.trim() || pathname
  const mainSpacingClass = shellVariant === "terminal" ? "pt-28 pb-6 sm:pt-32 sm:pb-10" : "py-6 sm:py-10"
  const checkInDisplayDate = activeDate
  const checkInDisplayTime = activeTime
  const checkInQrLink = React.useMemo(() => {
    if (!origin || !contextIsValid) return ""
    const params = new URLSearchParams()
    params.set("courseSlug", activeCourseSlug)
    params.set("date", activeDate)
    params.set("time", activeTime)
    params.set("durationMinutes", String(durationMinutes))
    params.set("fromQr", "1")
    return `${origin}${qrPath}?${params.toString()}`
  }, [activeCourseSlug, activeDate, activeTime, contextIsValid, durationMinutes, origin, qrPath])
  const checkInQrImage = React.useMemo(() => {
    if (!checkInQrLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(checkInQrLink)}`
  }, [checkInQrLink])
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
  const completionMode = isStationDeviceFlow ? "station" : "personal"
  const resetCustomerFlowState = React.useCallback(() => {
    setOpenNewBooking(false)
    setNewBookingOverride(null)
    setExistingRegularBookingOverride(null)
    setPaymentsModalReady(false)
    setMode("idle")
    setBootstrap(null)
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    setKioskPin("")
    setKioskPinSessionToken("")
    setKioskPinRotationRequired(false)
    setKioskPinRotationMode(null)
    setKioskPinNext("")
    setKioskPinConfirm("")
    setKioskPinAttemptsRemaining(null)
    setKioskPinBlockedUntil(null)
  }, [])
  const handleStationCompletion = React.useCallback(async () => {
    await completeKioskCustomerFlow({
      resetCustomerState: resetCustomerFlowState,
      isKioskTerminalFlow,
      isCustomerSignedIn: Boolean(isSignedIn),
      redirectUrl: stationRedirectUrl,
      sessionId: activeSessionId,
      signOut: clerk.signOut,
    })
  }, [activeSessionId, clerk, isKioskTerminalFlow, isSignedIn, resetCustomerFlowState, stationRedirectUrl])
  const showQrPanel = shouldShowCheckInQrPanel({
    hideQrPanel,
    hasQrImage: Boolean(checkInQrImage),
    isCompactViewport,
    isQrEntry,
    shellVariant,
  })
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
  const legacyContextMissing = !qrCourseSlug || !qrDate || !qrTime
  const showContextWarning = !contextIsValid && legacyContextMissing
  const hasKioskPinSession = Boolean(kioskPinSessionToken)
  const showSignedInBootstrapPanel = mode === "existing" && (isSignedIn || hasKioskPinSession)
  const showKioskPinPanel =
    mode === "existing" && isKioskTerminalFlow && !isSignedIn && (!bootstrap || kioskPinRotationRequired)
  const hideEntrySelection = showSignedInBootstrapPanel || showKioskPinPanel
  // Full-screen loader: covers the terminal existing-customer handoff while bootstrap is
  // resolving (or just resolved but the EnrollModal hasn't opened yet). Only shown in kiosk
  // terminal flows — personal/QR flows keep the inline skeleton.
  const showKioskResolvingOverlay = shouldShowKioskResolvingOverlay({
    isKioskTerminalFlow,
    mode,
    isSignedIn: Boolean(isSignedIn),
    loadingBootstrap,
    hasBootstrap: Boolean(bootstrap),
    hasExistingRegularBookingOverride: Boolean(existingRegularBookingOverride),
    hasVisibleError: Boolean(visibleError),
    paymentsStepReady: paymentsModalReady,
  })
  const showCourseCardPanel = Boolean(checkInDisplayCourse || currentHomeCourse) && !showSignedInBootstrapPanel
  const effectiveCheckInWindowOpen = Boolean(bootstrap?.context.checkInWindow.isOpen)
  const welcomeLabel = bootstrap?.customer.firstName || bootstrap?.customer.name || "student"
  const shellEyebrow = "QR Check-in"
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
      String(getCourseDurationMinutes(latePaymentRecommendation.courseSlug, sourceCourses, durationMinutes))
    )
    params.set("fromQr", "1")
    return `${origin}${qrPath}?${params.toString()}`
  }, [durationMinutes, latePaymentRecommendation, origin, qrPath, sourceCourses])
  const latePaymentQrImage = React.useMemo(() => {
    if (!latePaymentQrLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=${encodeURIComponent(latePaymentQrLink)}`
  }, [latePaymentQrLink])
  const showLatePaymentOffer = Boolean(
    shellVariant === "terminal" &&
      latePaymentRecommendation &&
      latePaymentCourse &&
      latePaymentQrImage &&
      !isLatePaymentContext
  )

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
      if (!isSignedIn && !hasKioskPinSession) {
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
    }
    return items
  }, [
    bootstrap?.quickCheckout,
    existingRegularBookingOverride,
    hasKioskPinSession,
    isSignedIn,
    kioskPinRotationRequired,
    loadingBootstrap,
    mode,
    openNewBooking,
    shellVariant,
    showKioskPinPanel,
  ])

  const loadBootstrap = React.useCallback(async () => {
    if (!contextIsValid) return
    if (!isSignedIn && !kioskPinSessionToken) return
    if (!isSignedIn && kioskPinRotationRequired) return
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
          ...(!isSignedIn && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
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
  }, [contextIsValid, contextPayload, getToken, isSignedIn, kioskPinRotationRequired, kioskPinSessionToken])

  const handlePackageCheckIn = React.useCallback(async () => {
    if (!bootstrap) return
    if (!isSignedIn) {
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
          ...(!isSignedIn && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
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
        setSuccess(`${successParts.join(" ")} Preparing terminal for the next student...`)
        window.setTimeout(() => {
          void handleStationCompletion()
        }, 1100)
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
    handleStationCompletion,
    isSignedIn,
    kioskPinSessionToken,
    isStationDeviceFlow,
    loadBootstrap,
  ])

  const handleKioskPinIdentify = React.useCallback(async () => {
    if (!isKioskTerminalFlow) return
    setKioskPinLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/checkin/pin/identify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ pin: kioskPin }),
      })
      const data = (await res.json().catch(() => null)) as
        | KioskPinIdentifyFailure
        | KioskPinIdentifySuccess
        | KioskPinIdentifyError
        | null

      if (!res.ok) {
        const failure = data && "identified" in data && !data.identified ? data : null
        const errorPayload = data && !("identified" in data) ? data : null
        setKioskPinSessionToken("")
        setKioskPinRotationRequired(false)
        setKioskPinRotationMode(null)
        setBootstrap(null)
        setKioskPinAttemptsRemaining(typeof failure?.attemptsRemaining === "number" ? failure.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof failure?.blockedUntil === "string" ? failure.blockedUntil : null)
        const failureMessage = typeof failure?.message === "string" ? failure.message : null
        const errorMessage = typeof errorPayload?.message === "string" ? errorPayload.message : null
        if ((failure?.requiresPinRegeneration || errorPayload?.requiresPinRegeneration) && (failureMessage || errorMessage)) {
          setError(failureMessage || errorMessage)
          return
        }
        setError(typeof errorPayload?.error === "string" ? errorPayload.error : "Unable to identify this student PIN.")
        return
      }

      if (!data || !("identified" in data)) {
        setKioskPinAttemptsRemaining(null)
        setKioskPinBlockedUntil(null)
        setError("We couldn't match that PIN. Please try again.")
        return
      }

      if (!data.identified) {
        setKioskPinAttemptsRemaining(typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof data.blockedUntil === "string" ? data.blockedUntil : null)
        setError(typeof data.message === "string" ? data.message : "We couldn't match that PIN. Please try again.")
        return
      }

      const nextRotationMode = data.requiresPinRotation
        ? data.requiresPinRegeneration || data.regenerationReason === "obsolete" || data.credentialKind === "permanent"
          ? "regeneration"
          : "provisional"
        : null

      setKioskPinSessionToken(data.sessionToken)
      setKioskPinRotationRequired(Boolean(data.requiresPinRotation))
      setKioskPinRotationMode(nextRotationMode)
      setKioskPinAttemptsRemaining(null)
      setKioskPinBlockedUntil(null)
      setKioskPin("")

      if (data.requiresPinRotation) {
        setSuccess(
          nextRotationMode === "regeneration"
            ? "Identity confirmed. Regenerate your PIN to continue."
            : "Identity confirmed. Create your permanent PIN to continue."
        )
        return
      }

      setSuccess("Identity confirmed. Loading your current class options...")
    } catch {
      setError("Unable to identify this student PIN.")
    } finally {
      setKioskPinLoading(false)
    }
  }, [isKioskTerminalFlow, kioskPin])

  const handleKioskPinRotate = React.useCallback(async () => {
    if (!kioskPinSessionToken) return
    setKioskPinRotating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/checkin/pin/rotate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sessionToken: kioskPinSessionToken,
          nextPin: kioskPinNext,
          confirmPin: kioskPinConfirm,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to rotate this student PIN.")
        return
      }

      setKioskPinRotationRequired(false)
      setKioskPinRotationMode(null)
      setKioskPinNext("")
      setKioskPinConfirm("")
      setSuccess("PIN updated. Loading your purchase options...")
    } catch {
      setError("Unable to rotate this student PIN.")
    } finally {
      setKioskPinRotating(false)
    }
  }, [kioskPinConfirm, kioskPinNext, kioskPinSessionToken])

  React.useEffect(() => {
    if (mode !== "existing") return
    if (!isLoaded) return
    if (!isSignedIn && !kioskPinSessionToken) return
    void loadBootstrap()
  }, [isLoaded, isSignedIn, kioskPinSessionToken, loadBootstrap, mode])

  React.useEffect(() => {
    if (entryMode === "existing" && mode !== "existing") {
      setMode("existing")
      return
    }
    if (isSignedIn && mode === "idle") {
      setMode("existing")
    }
  }, [entryMode, isSignedIn, mode])

  React.useEffect(() => {
    if (!isSignedIn) return
    if (showPhoneSignIn) {
      setShowPhoneSignIn(false)
    }
  }, [isSignedIn, showPhoneSignIn])

  React.useEffect(() => {
    if (!fixedContextRecommendation) return
    setManualRecommendation(null)
  }, [fixedContextRecommendation])

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
    return {
      serviceLabel,
      packageLabel,
      addonLabels,
    }
  }, [bootstrap?.quickCheckout, selectedCourse])

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

  const revealLastPinDigit = React.useCallback((field: "entry" | "next" | "confirm", index: number) => {
    if (typeof window === "undefined") return
    if (pinRevealTimeoutRef.current) {
      window.clearTimeout(pinRevealTimeoutRef.current)
    }
    setPinReveal({ field, index })
    pinRevealTimeoutRef.current = window.setTimeout(() => {
      setPinReveal((current) => (current?.field === field && current.index === index ? null : current))
      pinRevealTimeoutRef.current = null
    }, PIN_LAST_DIGIT_REVEAL_MS)
  }, [])

  React.useEffect(
    () => () => {
      if (pinRevealTimeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(pinRevealTimeoutRef.current)
      }
    },
    []
  )

  const openExistingPurchaseFlow = React.useCallback((context: { courseSlug: string; date: string; time: string }) => {
    setError(null)
    setSuccess(null)
    setPaymentsModalReady(false)
    setExistingRegularBookingKey((prev) => prev + 1)
    setExistingRegularBookingOverride(context)
  }, [])

  const handleExistingCustomerDismiss = React.useCallback(() => {
    if (isKioskTerminalFlow) {
      void handleStationCompletion()
      return
    }
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setMode("idle")
    setBootstrap(null)
    setError(null)
    setSuccess(null)
  }, [handleStationCompletion, isKioskTerminalFlow])

  React.useEffect(() => {
    if (!isKioskTerminalFlow) return
    if (mode !== "existing" || !isSignedIn || loadingBootstrap || !bootstrap) return
    if (existingRegularBookingOverride || openNewBooking || processingPackageCheckIn) return
    if (bootstrap.package) return

    openExistingPurchaseFlow({
      courseSlug: bootstrap.context.courseSlug,
      date: bootstrap.context.date,
      time: bootstrap.context.time,
    })
  }, [
    bootstrap,
    existingRegularBookingOverride,
    isKioskTerminalFlow,
    isSignedIn,
    loadingBootstrap,
    mode,
    openExistingPurchaseFlow,
    openNewBooking,
    processingPackageCheckIn,
  ])

  return (
    <main className={`relative min-h-screen overflow-hidden bg-[#13141d] px-3 ${mainSpacingClass} sm:px-4`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="relative mx-auto w-full max-w-4xl">
        <section className="rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.26),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-4 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur sm:p-6">
          {shellVariant === "terminal" ? (
            <>
              <div className="mt-4 grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-6">
                <div className="mx-auto inline-flex items-center md:mx-0 md:justify-self-start">
                  <Image
                    src="/logo/logo-white.png"
                    alt="Palladium Latin Art"
                    width={120}
                    height={48}
                    className="h-auto w-[calc(var(--spacing)*30)] object-contain"
                  />
                </div>
                <div className="text-center md:justify-self-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">{shellEyebrow}</p>
                  <h1 className="text-2xl font-semibold text-white">Student check-in</h1>
                  <p className="mt-1 text-sm text-white/72">{showSignedInBootstrapPanel && bootstrap ? `Welcome, ${welcomeLabel}` : "Welcome"}</p>
                </div>
                <nav
                  className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/55 md:justify-self-end md:justify-end"
                  aria-label="Breadcrumb"
                >
                  {breadcrumbItems.map((item, index) => (
                    <React.Fragment key={`${item}-${index}`}>
                      {index > 0 && <span className="text-white/35">/</span>}
                      <span className={index === breadcrumbItems.length - 1 ? "text-white/80" : ""}>{item}</span>
                    </React.Fragment>
                  ))}
                </nav>
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">{shellEyebrow}</p>
                <Image
                  src="/logo/logo-white.png"
                  alt="Palladium Latin Art"
                  width={120}
                  height={48}
                  className="h-auto w-[calc(var(--spacing)*20)] object-contain"
                />
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-white">Student check-in</h1>
              <p className="text-sm text-white/70">
                {showSignedInBootstrapPanel && bootstrap ? `Welcome, ${welcomeLabel}` : "Welcome"}
              </p>
              {breadcrumbItems.length > 1 && (
                <nav className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/55" aria-label="Breadcrumb">
                  {breadcrumbItems.map((item, index) => (
                    <React.Fragment key={`${item}-${index}`}>
                      {index > 0 && <span className="text-white/35">/</span>}
                      <span className={index === breadcrumbItems.length - 1 ? "text-white/80" : ""}>{item}</span>
                    </React.Fragment>
                  ))}
                </nav>
              )}
            </>
          )}

          {showCourseCardPanel && showQrPanel && (
            <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.02] px-4 py-5 sm:px-6">
              <div className="grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_1px_16rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_1px_18rem] lg:gap-6">
                <article className="flex h-full flex-col">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Home card preview</p>
                  <div className="mt-2 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
                    <div className="grid h-full grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className="relative min-h-[220px] xl:h-full xl:min-h-0">
                        <Image
                          src={checkInCardImage}
                          alt={checkInDisplayCourse?.title || "Current course"}
                          fill
                          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 38vw, 32vw"
                          className="object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.62))]" />
                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--brand,#b61616)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                            {checkInCardCategory}
                          </span>
                          <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/85">
                            {checkInCardBadge}
                          </span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                          <div className="flex flex-wrap gap-2 text-xs text-white/85">
                            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{checkInCardDuration}</span>
                            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{checkInCardStudents}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex h-full flex-col justify-between p-4 sm:p-5">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">{checkInCardCategory}</p>
                          <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">
                            {checkInDisplayCourse?.title || "Current course"}
                          </h3>
                          <p className="mt-2 text-sm text-white/75">{checkInDisplayDate} {checkInDisplayTime}</p>
                          <p className="mt-4 text-sm leading-relaxed text-white/76">{checkInCardDescription}</p>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/78">
                          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Instructor: {checkInCardTeacher}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <div className="hidden h-full w-px bg-white/15 md:block" aria-hidden />

                <div className="flex h-full flex-col items-center justify-center text-center md:pt-2 lg:pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">QR Code</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={checkInQrImage}
                    alt="Check-in QR"
                    className="mt-4 h-48 w-48 rounded-2xl border border-white/15 bg-white object-contain lg:h-56 lg:w-56"
                  />
                  <p className="mt-4 max-w-[17rem] text-base font-medium leading-relaxed text-white/82">
                    scan this code to continue the check-in process
                  </p>
                </div>
              </div>
            </div>
          )}
          {showCourseCardPanel && !showQrPanel && (
            <div className="mt-6">
              <article className="overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
                <div className="grid grid-cols-[0.92fr_1.08fr] sm:grid-cols-[0.9fr_1.1fr]">
                  <div className="relative min-h-[18rem]">
                    <Image
                      src={checkInCardImage}
                      alt={checkInDisplayCourse?.title || "Current course"}
                      fill
                      sizes="(max-width: 640px) 42vw, 32vw"
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.62))]" />
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--brand,#b61616)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                        {checkInCardCategory}
                      </span>
                      <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/85">
                        {checkInCardBadge}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                      <div className="flex flex-wrap gap-2 text-xs text-white/85">
                        <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{checkInCardDuration}</span>
                        <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{checkInCardStudents}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex h-full min-h-[18rem] flex-col justify-between p-3 sm:p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">{checkInCardCategory}</p>
                      <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
                        {checkInDisplayCourse?.title || "Current course"}
                      </h3>
                      <p className="mt-2 text-xs text-white/75 sm:text-sm">{checkInDisplayDate} {checkInDisplayTime}</p>
                      <p className="mt-4 text-sm leading-relaxed text-white/76">{checkInCardDescription}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/78">
                      <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Instructor: {checkInCardTeacher}</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}
          {showQrPanel && (
            <p
              className={
                shellVariant === "terminal"
                  ? "mt-7 text-center text-base font-medium tracking-[0.02em] text-white/78"
                  : "mt-7 text-center text-lg font-semibold tracking-[0.14em] text-[var(--brand,#ff3f3f)]"
              }
          >
              {shellVariant === "terminal"
                ? "you can complete your check-in on this tablet"
                : "or complete the process right here"}
            </p>
          )}

          {showContextWarning && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              The QR code is missing required data. Use a link with `courseSlug`, `date`, and `time`.
            </div>
          )}

          {showLatePaymentOffer && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 px-4 py-4">
              <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Previous class pending</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {latePaymentCourse?.title || "Previous class"}
                  </h3>
                  <p className="mt-2 text-sm text-white/72">
                    {latePaymentRecommendation?.date} {latePaymentRecommendation?.time}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/68">
                    Regular check-in has already closed for this class. If the student arrived late or prefers to pay at the end,
                    they can scan this QR or use this same tablet.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!latePaymentRecommendation) return
                        setError(null)
                        setSuccess(null)
                        setBootstrap(null)
                        setManualRecommendation(latePaymentRecommendation)
                        setMode("idle")
                      }}
                      className="rounded-xl border border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.18)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Pay on this tablet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!latePaymentQrLink || typeof window === "undefined") return
                        window.open(latePaymentQrLink, "_blank", "noopener,noreferrer")
                      }}
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82"
                    >
                      Open on phone
                    </button>
                  </div>
                </div>
                <div className="mx-auto text-center lg:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={latePaymentQrImage}
                    alt="Late payment QR"
                    className="h-40 w-40 rounded-2xl border border-white/15 bg-white object-contain"
                  />
                  <p className="mt-3 max-w-[11rem] text-sm text-white/72">
                    Scan this QR to pay for the previous class from your phone.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hideEntrySelection && (
            <div className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setMode("existing")
                  setError(null)
                  setSuccess(null)
                  setBootstrap(null)
                  setKioskPin("")
                    setKioskPinSessionToken("")
                    setKioskPinRotationRequired(false)
                    setKioskPinRotationMode(null)
                    setKioskPinNext("")
                  setKioskPinConfirm("")
                  setKioskPinAttemptsRemaining(null)
                  setKioskPinBlockedUntil(null)
                  if (!selectedCourse || !contextIsValid) {
                    setError("We couldn't open the purchase because QR data is missing.")
                    return
                  }
                  if (isKioskTerminalFlow && !isSignedIn) {
                    return
                  }
                  if (!isSignedIn) {
                    setShowPhoneSignIn(true)
                    return
                  }
                  void loadBootstrap()
                }}
                className={`min-h-[104px] rounded-2xl border px-4 py-4 text-left sm:min-h-[112px] sm:px-5 sm:py-5 ${
                  mode === "existing"
                    ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                    : "border-white/15 bg-black/20 text-white/80"
                }`}
              >
                <p className="text-sm font-semibold">I am already a customer</p>
                 <p className="mt-1 text-xs text-white/60">
                   {isKioskTerminalFlow ? "Enter your PIN to continue on this terminal." : "Sign in and repurchase the current course."}
                 </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("new")
                  setError(null)
                  setSuccess(null)
                  const fallbackCourse = selectedCourse
                  const resolvedCourse = fallbackCourse
                  if (!resolvedCourse || !contextIsValid) {
                    setError("We couldn't open the purchase because QR data is missing.")
                    return
                  }
                  setNewBookingOverride({
                    courseSlug: resolvedCourse.slug,
                    date: activeDate,
                    time: activeTime,
                  })
                  setOpenNewBooking(true)
                }}
                className={`min-h-[104px] rounded-2xl border px-4 py-4 text-left sm:min-h-[112px] sm:px-5 sm:py-5 ${
                  mode === "new"
                    ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                    : "border-white/15 bg-black/20 text-white/80"
                }`}
              >
                <p className="text-sm font-semibold">I am new</p>
                <p className="mt-1 text-xs text-white/60">Open regular purchase with account creation included.</p>
              </button>
            </div>
          )}

          {showKioskPinPanel && (
            <div className="fixed inset-0 z-[12000] flex items-start justify-center bg-black/72 px-4 pb-4 pt-28 backdrop-blur-sm sm:px-6 sm:pt-32 md:pb-6 md:pt-36 lg:items-center lg:pt-10">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="existing-customer-pin-title"
                className="w-full max-w-[24rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.22),transparent_54%),linear-gradient(160deg,rgba(12,15,28,0.99),rgba(21,25,40,0.97))] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] md:max-w-[46rem]"
              >
                <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">
                          {hasKioskPinSession ? "Permanent PIN required" : "Existing student PIN"}
                        </p>
                        <h2 id="existing-customer-pin-title" className="mt-1 text-lg font-semibold text-white sm:text-xl">
                          {hasKioskPinSession
                            ? kioskPinRotationMode === "regeneration"
                              ? "Regenerate your 4-digit PIN"
                              : "Create your new 4-digit PIN"
                            : "Enter your 4-digit PIN"}
                        </h2>
                        <p className="mt-1 max-w-[34rem] text-sm leading-relaxed text-white/68">
                          {hasKioskPinSession
                            ? kioskPinRotationMode === "regeneration"
                              ? "This PIN expired after inactivity. Set a new permanent PIN now before continuing to purchase."
                              : "This provisional PIN only works once. Set a permanent PIN now before continuing to purchase."
                            : "We&apos;ll identify your account here and continue on this terminal."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExistingCustomerDismiss}
                        className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
                      >
                        Close
                      </button>
                    </div>

                    {!hasKioskPinSession ? (
                      <>
                        <div className="mt-5 rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-5 text-center text-2xl tracking-[0.35em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:text-[2rem]">
                          {formatMaskedPinDisplay(kioskPin, pinReveal?.field === "entry" ? pinReveal.index : null)}
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/48">
                          Digits stay hidden after a brief confirmation.
                        </p>
                        {typeof kioskPinAttemptsRemaining === "number" && kioskPinAttemptsRemaining >= 0 && (
                          <p className="mt-4 text-xs text-white/58">Attempts remaining on this terminal: {kioskPinAttemptsRemaining}</p>
                        )}
                        {kioskPinBlockedUntil && (
                          <p className="mt-2 text-xs text-amber-200/90">This terminal is temporarily blocked until {toEsDateTime(kioskPinBlockedUntil)}.</p>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleKioskPinIdentify()}
                          disabled={kioskPinLoading || kioskPin.length !== 4}
                          className="mt-5 w-full rounded-xl bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {kioskPinLoading ? "Checking PIN..." : "Continue"}
                        </button>
                        {visibleError ? <p className="mt-3 text-sm text-red-200">{visibleError}</p> : null}
                        {success ? <p className="mt-3 text-sm text-emerald-200">{success}</p> : null}
                      </>
                    ) : (
                      <>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-white/55">New PIN</p>
                            <div className="rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-4 text-center text-xl tracking-[0.3em] text-white sm:text-2xl">
                              {formatMaskedPinDisplay(kioskPinNext, pinReveal?.field === "next" ? pinReveal.index : null)}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-white/55">Confirm PIN</p>
                            <div className="rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-4 text-center text-xl tracking-[0.3em] text-white sm:text-2xl">
                              {formatMaskedPinDisplay(kioskPinConfirm, pinReveal?.field === "confirm" ? pinReveal.index : null)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleKioskPinRotate()}
                          disabled={kioskPinRotating || kioskPinNext.length !== 4 || kioskPinConfirm.length !== 4}
                          className="mt-5 w-full rounded-xl bg-[var(--brand,#b61616)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {kioskPinRotating ? "Saving PIN..." : "Save new PIN"}
                        </button>
                        {visibleError ? <p className="mt-3 text-sm text-red-200">{visibleError}</p> : null}
                        {success ? <p className="mt-3 text-sm text-emerald-200">{success}</p> : null}
                      </>
                    )}
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(210,52,52,0.16),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 sm:p-4">
                    <KioskNumericKeypad
                      className="h-full border-0 bg-transparent p-0"
                      disabled={hasKioskPinSession ? kioskPinRotating : kioskPinLoading}
                      onDigit={(digit) => {
                        if (!hasKioskPinSession) {
                          setKioskPin((current) => {
                            const nextValue = `${current}${digit}`.slice(0, 4)
                            if (nextValue.length > current.length) {
                              revealLastPinDigit("entry", nextValue.length - 1)
                            }
                            return nextValue
                          })
                          setError(null)
                          return
                        }

                        if (kioskPinNext.length < 4) {
                          setKioskPinNext((current) => {
                            const nextValue = `${current}${digit}`.slice(0, 4)
                            if (nextValue.length > current.length) {
                              revealLastPinDigit("next", nextValue.length - 1)
                            }
                            return nextValue
                          })
                        } else {
                          setKioskPinConfirm((current) => {
                            const nextValue = `${current}${digit}`.slice(0, 4)
                            if (nextValue.length > current.length) {
                              revealLastPinDigit("confirm", nextValue.length - 1)
                            }
                            return nextValue
                          })
                        }
                        setError(null)
                      }}
                      onBackspace={() => {
                        if (!hasKioskPinSession) {
                          setKioskPin((current) => current.slice(0, -1))
                          setPinReveal((current) => (current?.field === "entry" ? null : current))
                          setError(null)
                          return
                        }

                        if (kioskPinConfirm.length > 0) {
                          setKioskPinConfirm((current) => current.slice(0, -1))
                          setPinReveal((current) => (current?.field === "confirm" ? null : current))
                        } else {
                          setKioskPinNext((current) => current.slice(0, -1))
                          setPinReveal((current) => (current?.field === "next" ? null : current))
                        }
                        setError(null)
                      }}
                      onClear={() => {
                        if (!hasKioskPinSession) {
                          setKioskPin("")
                          setPinReveal((current) => (current?.field === "entry" ? null : current))
                          setError(null)
                          return
                        }

                        if (kioskPinConfirm.length > 0) {
                          setKioskPinConfirm("")
                          setPinReveal((current) => (current?.field === "confirm" ? null : current))
                        } else {
                          setKioskPinNext("")
                          setPinReveal((current) => (current?.field === "next" ? null : current))
                        }
                        setError(null)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSignedInBootstrapPanel && (
            <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/80">Active session for fast flow.</p>
                <button
                  type="button"
                  onClick={() =>
                    void clerk.signOut({
                      redirectUrl: forceRedirectUrl,
                      ...(activeSessionId ? { sessionId: activeSessionId } : {}),
                    })
                  }
                  className="text-xs text-white/70 underline"
                >
                  Switch account
                </button>
              </div>
              {loadingBootstrap ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-white/65">Checking purchases for the current course...</p>
                  <div className="h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
                </div>
              ) : bootstrap ? (
                <div className="mt-3 space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
                    <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr]">
                      <div className="relative h-52 bg-black/30 sm:h-full">
                        <Image
                          src={bootstrapCourseImage}
                          alt={bootstrap.context.courseTitle}
                          fill
                          sizes="(max-width: 640px) 100vw, 210px"
                          className="object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.62))]" />
                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--brand,#b61616)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                            {bootstrapCardCategory}
                          </span>
                          <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/85">
                            {bootstrapCardBadge}
                          </span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                          <div className="flex flex-wrap gap-2 text-xs text-white/85">
                            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{bootstrapCardDuration}</span>
                            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1">{bootstrapCardStudents}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col justify-between p-4 text-white/85">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">Current course</p>
                          <h3 className="mt-2 text-lg font-semibold leading-tight text-white sm:text-2xl">
                            {bootstrap.context.courseTitle}
                          </h3>
                          <p className="mt-2 text-xs text-white/75 sm:text-sm">
                            {bootstrap.context.date} {bootstrap.context.time}
                          </p>
                          <p className="mt-4 text-sm leading-relaxed text-white/76">{bootstrapCardDescription}</p>
                          <p className="mt-4 text-xs text-white/65">
                            Check-in window: {toEsDateTime(bootstrap.context.checkInWindow.opensAt)} to{" "}
                            {toEsDateTime(bootstrap.context.checkInWindow.closesAt)}
                          </p>
                          {bootstrap.quickCheckout && (
                            <div className="mt-3 space-y-1 text-xs text-white/65">
                              <p>Service: {quickCheckoutDetails?.serviceLabel || bootstrap.quickCheckout.serviceId}</p>
                              {quickCheckoutDetails?.packageLabel && <p>Package: {quickCheckoutDetails.packageLabel}</p>}
                              {quickCheckoutDetails?.addonLabels && quickCheckoutDetails.addonLabels.length > 0 && (
                                <p>Extras: {quickCheckoutDetails.addonLabels.join(", ")}</p>
                              )}
                            </div>
                          )}
                          {bootstrap.package && (
                            <div className="mt-3 space-y-1 text-xs text-white/65">
                              <p>
                                Active package: {bootstrap.package.packageLabel || bootstrap.package.packageId}
                              </p>
                              <p>
                                Credits:{" "}
                                {bootstrap.package.isUnlimited
                                  ? "Unlimited"
                                  : typeof bootstrap.package.remainingCredits === "number"
                                    ? bootstrap.package.remainingCredits
                                    : "0"}
                              </p>
                              {bootstrap.package.expiresAt && (
                                <p>Expires: {toEsDateTime(bootstrap.package.expiresAt)}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-col items-start gap-3">
                          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/78">
                            Instructor: {bootstrapCardTeacher}
                          </span>
                          {isLatePaymentContext && (
                            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-100/92">
                              Late payment for previous class
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (processingPackageCheckIn) return
                              if (!effectiveCheckInWindowOpen) {
                                setError("The check-in window for this class is closed.")
                                return
                              }
                              if (bootstrap.package) {
                                void handlePackageCheckIn()
                                return
                              }
                              if (bootstrap.quickCheckout) {
                                openExistingPurchaseFlow({
                                  courseSlug: bootstrap.context.courseSlug,
                                  date: bootstrap.context.date,
                                  time: bootstrap.context.time,
                                })
                                return
                              }
                              if (bootstrap.hasAnyCompletedPurchase) {
                                openExistingPurchaseFlow({
                                  courseSlug: bootstrap.context.courseSlug,
                                  date: bootstrap.context.date,
                                  time: bootstrap.context.time,
                                })
                                return
                              }
                              openExistingPurchaseFlow({
                                courseSlug: bootstrap.context.courseSlug,
                                date: bootstrap.context.date,
                                time: bootstrap.context.time,
                              })
                            }}
                            className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
                              effectiveCheckInWindowOpen
                                ? "bg-[var(--brand,#b61616)]"
                                : "bg-white/15"
                            }`}
                          >
                            {processingPackageCheckIn
                              ? "Checking in..."
                              : bootstrap.package
                                ? "Check in with package"
                                : bootstrap.quickCheckout
                                  ? "Repurchase"
                                  : "Buy"}
                          </button>
                          {isLatePaymentContext && !fixedContextRecommendation && (
                            <button
                              type="button"
                              onClick={() => {
                                setError(null)
                                setSuccess(null)
                                setBootstrap(null)
                                setManualRecommendation(null)
                                setMode("idle")
                              }}
                              className="text-xs text-white/70 underline"
                            >
                              Back to current class
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3" />
              )}
            </div>
          )}

          {visibleError && <p className="mt-4 text-sm text-red-300">{visibleError}</p>}
          {success && <p className="mt-4 text-sm text-emerald-300">{success}</p>}
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
          completionMode={completionMode}
          checkInContext={newBookingContext}
          photoFlowContext={photoFlowContext}
          useDraft={false}
          mode="modal"
          onCompletedAction={isStationDeviceFlow ? handleStationCompletion : undefined}
        />
      )}

      {showKioskResolvingOverlay && (
        <div
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading"
          className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-[#13141d]"
        >
          <svg
            className="h-10 w-10 animate-spin text-[var(--brand,#b61616)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="mt-4 text-sm text-white/65">
            Alright niños, hang tight — we&apos;re getting your payment ready.
          </p>
        </div>
      )}

      {showPhoneSignIn && !isSignedIn && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[23rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Quick sign-in</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Sign in with your account</h2>
                <p className="mt-1 text-sm text-white/68">Use your access to continue with repurchasing the current course.</p>
              </div>
              <button
                type="button"
                onClick={handleExistingCustomerDismiss}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <EmbeddedSignIn
                redirectUrl={forceRedirectUrl}
                phoneNumber={toE164Phone(pendingLoginPhone)}
                useNumericKeypad={photoFlowContext === "kiosk_terminal"}
                onSuccessAction={async () => {
                  setShowPhoneSignIn(false)
                  setPendingLoginPhone("")
                  setError(null)
                  setSuccess(null)
                  setBootstrap(null)
                }}
              />
            </div>
          </div>
        </div>
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
          initialStep={getExistingCustomerInitialStep({ isKioskTerminalFlow })}
          prefillSelection={
            bootstrap?.quickCheckout
              ? {
                  service: bootstrap.quickCheckout.serviceId,
                  packageId: bootstrap.quickCheckout.packageId || "",
                  addons: bootstrap.quickCheckout.addons,
                  participants: bootstrap.quickCheckout.participants,
                  paymentMethod: "stripe",
                }
              : undefined
          }
          flowVariant="checkin-existing"
          completionMode={completionMode}
          checkInContext={existingRegularBookingContext}
          kioskSessionToken={!isSignedIn && kioskPinSessionToken ? kioskPinSessionToken : undefined}
          photoFlowContext={photoFlowContext}
          useDraft={false}
          mode="modal"
          onCompletedAction={isStationDeviceFlow ? handleStationCompletion : undefined}
          prefillContact={
            bootstrap
              ? {
                  firstName: bootstrap.customer.firstName,
                  lastName: bootstrap.customer.lastName,
                  email: bootstrap.customer.email,
                  phone: bootstrap.customer.phone,
                }
              : undefined
          }
        />
      )}

    </main>
  )
}
