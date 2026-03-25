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

export default function CheckInQrClient({
  forcedDeviceMode,
  forcedCourseSlug = "",
  hideQrPanel = false,
  shellVariant = "qr",
  terminalName = "",
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
  const [processingPackageCheckIn, setProcessingPackageCheckIn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
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
    setMode("idle")
    setBootstrap(null)
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
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
  const showSignedInBootstrapPanel = mode === "existing" && isSignedIn
  const hideEntrySelection = showSignedInBootstrapPanel
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
      if (!isSignedIn) {
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
  }, [bootstrap?.quickCheckout, existingRegularBookingOverride, isSignedIn, loadingBootstrap, mode, openNewBooking, shellVariant])

  const loadBootstrap = React.useCallback(async () => {
    if (!contextIsValid || !isSignedIn) return
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
        body: JSON.stringify(contextPayload),
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
  }, [contextIsValid, contextPayload, getToken, isSignedIn])

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
    isStationDeviceFlow,
    loadBootstrap,
  ])

  React.useEffect(() => {
    if (mode !== "existing") return
    if (!isLoaded || !isSignedIn) return
    void loadBootstrap()
  }, [isLoaded, isSignedIn, loadBootstrap, mode])

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

  const openExistingPurchaseFlow = React.useCallback((context: { courseSlug: string; date: string; time: string }) => {
    setError(null)
    setSuccess(null)
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
                  if (!selectedCourse || !contextIsValid) {
                    setError("We couldn't open the purchase because QR data is missing.")
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
                <p className="mt-1 text-xs text-white/60">Sign in and repurchase the current course.</p>
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
          <p className="mt-4 text-sm text-white/65">One moment...</p>
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
