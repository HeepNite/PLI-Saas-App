"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { demoCourses } from "@/constants/courses"
import { homeCourses } from "@/constants/home-content"
import EnrollModal from "@/components/front/courses/EnrollModal"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { buildSessionStartsAt, getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { toE164Phone } from "@/components/front/courses/utils/phone"

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
    firstName: string
    lastName: string
    name: string
    email: string
    phone: string
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
  if (!key) return "Programa"
  return key.charAt(0).toUpperCase() + key.slice(1)
}

const getCourseDurationMinutes = (courseSlug: string, fallbackMinutes = 60) => {
  const course = demoCourses.find((item) => item.slug === courseSlug)
  const match = course?.duration?.match(/(\d+)/)
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (!Number.isFinite(parsed)) return fallbackMinutes
  return Math.max(15, Math.min(240, parsed))
}

const pickWalkInRecommendation = (referenceDate = new Date(), preferredCourseSlug = "") => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null as null | { courseSlug: string; date: string; time: string }
  const nowMinutes = toMinutes(getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE))

  const preferredFamily = getCourseFamilyKey(preferredCourseSlug)

  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const dateIso = shiftIsoDate(todayIso, dayOffset)
    let bestForDay: null | { courseSlug: string; date: string; time: string; minutes: number; preferred: boolean } = null

    for (const course of demoCourses) {
      const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, dateIso))
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

const pickLatePaymentRecommendation = (referenceDate = new Date()) => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null as null | { courseSlug: string; date: string; time: string }
  const nowMs = referenceDate.getTime()
  let bestMatch: null | { courseSlug: string; date: string; time: string; startsAtMs: number } = null
  const todaySlots: Array<{ courseSlug: string; time: string; startsAtMs: number; endsAtMs: number }> = []

  for (const course of demoCourses) {
    const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, todayIso))
    const durationMinutes = getCourseDurationMinutes(course.slug)
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
  return new Intl.DateTimeFormat("es-ES", {
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useUser()
  const { getToken } = useAuth()
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
    () => demoCourses.find((course) => course.slug === baseCourseSlug) || null,
    [baseCourseSlug]
  )
  const latePaymentRecommendation = React.useMemo(
    () => (shellVariant === "terminal" && !hasExplicitContext ? pickLatePaymentRecommendation(nowTick) : null),
    [hasExplicitContext, nowTick, shellVariant]
  )
  const walkInRecommendation = React.useMemo(
    () => pickWalkInRecommendation(nowTick, baseCourseSlug),
    [baseCourseSlug, nowTick]
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
    () => demoCourses.find((course) => course.slug === activeCourseSlug) || null,
    [activeCourseSlug]
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
  const existingEntryRedirectUrl = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("entry", "existing")
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
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const visibleError = React.useMemo(() => {
    if (!error) return null
    const normalized = error.trim().toLowerCase()
    if (
      normalized.includes("no pudimos preparar el flujo rápido") ||
      normalized.includes("no pudimos cargar el flujo rápido")
    ) {
      return null
    }
    return error
  }, [error])
  const newBookingCourse = React.useMemo(
    () => demoCourses.find((course) => course.slug === (newBookingOverride?.courseSlug || "")) || selectedCourse || qrCourse,
    [newBookingOverride?.courseSlug, qrCourse, selectedCourse]
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
      demoCourses.find((course) => course.slug === (existingRegularBookingOverride?.courseSlug || "")) ||
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
  }, [existingRegularBookingOverride?.courseSlug, qrCourse, selectedCourse])
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
  const isExplicitStationDevice =
    forcedDeviceMode === "station" ||
    deviceMode === "station" ||
    deviceMode === "local" ||
    deviceMode === "terminal"
  const isPersonalForced = forcedDeviceMode === "personal"
  const isStationDeviceFlow = isPersonalForced ? false : isExplicitStationDevice || (!isQrEntry && !isCompactViewport)
  const completionMode = isStationDeviceFlow ? "station" : "personal"
  const handleStationCompletion = React.useCallback(async () => {
    setOpenNewBooking(false)
    setNewBookingOverride(null)
    setExistingRegularBookingOverride(null)
    setMode("idle")
    setBootstrap(null)
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    await clerk.signOut({ redirectUrl: stationRedirectUrl })
  }, [clerk, stationRedirectUrl])
  const showQrPanel = !hideQrPanel && Boolean(checkInQrImage) && !isCompactViewport && !isQrEntry
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
    "Grupos reducidos"
  const checkInCardBadge = currentHomeCourse?.badge || "Check-in presencial"
  const checkInCardCategory = currentHomeCourse?.category || toCategoryLabel(checkInDisplayCourse?.slug || activeCourseSlug)
  const checkInCardDescription =
    currentHomeCourse?.description ||
    checkInDisplayCourse?.description ||
    "Clase activa en el establecimiento."
  const bootstrapCourse = React.useMemo(
    () => demoCourses.find((course) => course.slug === (bootstrap?.context.courseSlug || "")) || selectedCourse || qrCourse || null,
    [bootstrap?.context.courseSlug, qrCourse, selectedCourse]
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
    "Grupos reducidos"
  const bootstrapCardTeacher =
    bootstrapHomeCourse?.teacher ||
    bootstrapCourse?.instructors?.map((item) => item.name).filter(Boolean).join(" / ") ||
    "PLI Team"
  const bootstrapCardDescription =
    bootstrapHomeCourse?.description || bootstrapCourse?.description || "Clase activa en el establecimiento."
  const legacyContextMissing = !qrCourseSlug || !qrDate || !qrTime
  const showContextWarning = !contextIsValid && legacyContextMissing
  const hideEntrySelection = mode === "existing" && isSignedIn
  const showCourseCardPanel = Boolean(checkInDisplayCourse || currentHomeCourse) && !(mode === "existing" && isSignedIn)
  const effectiveCheckInWindowOpen = Boolean(bootstrap?.context.checkInWindow.isOpen)
  const welcomeLabel = bootstrap?.customer.firstName || bootstrap?.customer.name || "alumno"
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
        ? demoCourses.find((course) => course.slug === latePaymentRecommendation.courseSlug) || null
        : null,
    [latePaymentRecommendation]
  )
  const latePaymentQrLink = React.useMemo(() => {
    if (!origin || !latePaymentRecommendation) return ""
    const params = new URLSearchParams()
    params.set("courseSlug", latePaymentRecommendation.courseSlug)
    params.set("date", latePaymentRecommendation.date)
    params.set("time", latePaymentRecommendation.time)
    params.set(
      "durationMinutes",
      String(getCourseDurationMinutes(latePaymentRecommendation.courseSlug, durationMinutes))
    )
    params.set("fromQr", "1")
    return `${origin}${qrPath}?${params.toString()}`
  }, [durationMinutes, latePaymentRecommendation, origin, qrPath])
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
      items.push("Soy nuevo")
      if (openNewBooking) items.push("Compra")
      return items
    }
    if (mode === "existing") {
      items.push("Ya soy cliente")
      if (!isSignedIn) {
        items.push("Login")
        return items
      }
      if (loadingBootstrap) {
        items.push("Cargando")
        return items
      }
      items.push("Curso actual")
      if (bootstrap?.quickCheckout) {
        items.push("Recomprar")
      } else if (existingRegularBookingOverride) {
        items.push("Compra regular")
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
                  <h1 className="text-2xl font-semibold text-white">Ingreso de alumnos</h1>
                  <p className="mt-1 text-sm text-white/72">{mode === "existing" && isSignedIn && bootstrap ? `Welcome, ${welcomeLabel}` : "Welcome"}</p>
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
              <h1 className="mt-3 text-2xl font-semibold text-white">Ingreso de alumnos</h1>
              <p className="text-sm text-white/70">
                {mode === "existing" && isSignedIn && bootstrap ? `Welcome, ${welcomeLabel}` : "Welcome"}
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
              <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_1px_0.5fr] lg:gap-6">
                <article className="flex h-full flex-col">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Home card preview</p>
                  <div className="mt-2 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
                    <div className="grid h-full grid-cols-1 sm:grid-cols-[0.9fr_1.1fr]">
                      <div className="relative min-h-[220px] sm:h-full sm:min-h-0">
                        <Image
                          src={checkInCardImage}
                          alt={checkInDisplayCourse?.title || "Curso actual"}
                          fill
                          sizes="(max-width: 1024px) 100vw, 32vw"
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
                            {checkInDisplayCourse?.title || "Curso actual"}
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

                <div className="hidden h-full w-px bg-white/15 lg:block" aria-hidden />

                <div className="flex h-full flex-col items-center justify-center text-center lg:pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Código QR</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={checkInQrImage}
                    alt="QR de check-in"
                    className="mt-4 h-52 w-52 rounded-2xl border border-white/15 bg-white object-contain sm:h-56 sm:w-56"
                  />
                  <p className="mt-4 max-w-[17rem] text-base font-medium leading-relaxed text-white/82">
                    escanea este codigo para continuar con el proceso de check in
                  </p>
                </div>
              </div>
            </div>
          )}
          {showCourseCardPanel && !showQrPanel && (
            <div className="mt-6">
              <article className="overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))]">
                <div className="grid h-full grid-cols-[0.92fr_1.08fr] sm:grid-cols-[0.9fr_1.1fr]">
                  <div className="relative min-h-[18rem] sm:h-full sm:min-h-0">
                    <Image
                      src={checkInCardImage}
                      alt={checkInDisplayCourse?.title || "Curso actual"}
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
                        {checkInDisplayCourse?.title || "Curso actual"}
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
                ? "puedes hacer tu check-in en esta tablet"
                : "o completa el proceso desde aqui mismo"}
            </p>
          )}

          {showContextWarning && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              El QR no tiene los datos completos. Usa un enlace con `courseSlug`, `date` y `time`.
            </div>
          )}

          {showLatePaymentOffer && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 px-4 py-4">
              <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Clase anterior pendiente</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {latePaymentCourse?.title || "Clase anterior"}
                  </h3>
                  <p className="mt-2 text-sm text-white/72">
                    {latePaymentRecommendation?.date} {latePaymentRecommendation?.time}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/68">
                    El check-in normal ya cerró para esta clase. Si el alumno llegó tarde o prefiere pagar al final,
                    puede escanear este QR o usar esta misma tablet.
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
                      Pagar en esta tablet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!latePaymentQrLink || typeof window === "undefined") return
                        window.open(latePaymentQrLink, "_blank", "noopener,noreferrer")
                      }}
                      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/82"
                    >
                      Abrir en teléfono
                    </button>
                  </div>
                </div>
                <div className="mx-auto text-center lg:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={latePaymentQrImage}
                    alt="QR de pago tardío"
                    className="h-40 w-40 rounded-2xl border border-white/15 bg-white object-contain"
                  />
                  <p className="mt-3 max-w-[11rem] text-sm text-white/72">
                    Escanea este QR para pagar la clase anterior desde el celular.
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
                <p className="text-sm font-semibold">Ya soy cliente</p>
                <p className="mt-1 text-xs text-white/60">Login y recompra del curso actual.</p>
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
                    setError("No pudimos abrir la compra porque faltan datos del QR.")
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
                <p className="text-sm font-semibold">Soy nuevo</p>
                <p className="mt-1 text-xs text-white/60">Abrir compra regular con creación de cuenta incluida.</p>
              </button>
            </div>
          )}

          {mode === "existing" && isSignedIn && (
            <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/80">Sesión activa para flujo rápido.</p>
                <button
                  type="button"
                  onClick={() => void clerk.signOut({ redirectUrl: forceRedirectUrl })}
                  className="text-xs text-white/70 underline"
                >
                  Cambiar cuenta
                </button>
              </div>
              {loadingBootstrap ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-white/65">Verificando compras del curso actual...</p>
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
                          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--brand,#ff4b4b)]">Curso actual</p>
                          <h3 className="mt-2 text-lg font-semibold leading-tight text-white sm:text-2xl">
                            {bootstrap.context.courseTitle}
                          </h3>
                          <p className="mt-2 text-xs text-white/75 sm:text-sm">
                            {bootstrap.context.date} {bootstrap.context.time}
                          </p>
                          <p className="mt-4 text-sm leading-relaxed text-white/76">{bootstrapCardDescription}</p>
                          <p className="mt-4 text-xs text-white/65">
                            Ventana check-in: {toEsDateTime(bootstrap.context.checkInWindow.opensAt)} a{" "}
                            {toEsDateTime(bootstrap.context.checkInWindow.closesAt)}
                          </p>
                          {bootstrap.quickCheckout && (
                            <div className="mt-3 space-y-1 text-xs text-white/65">
                              <p>Servicio: {quickCheckoutDetails?.serviceLabel || bootstrap.quickCheckout.serviceId}</p>
                              {quickCheckoutDetails?.packageLabel && <p>Paquete: {quickCheckoutDetails.packageLabel}</p>}
                              {quickCheckoutDetails?.addonLabels && quickCheckoutDetails.addonLabels.length > 0 && (
                                <p>Extras: {quickCheckoutDetails.addonLabels.join(", ")}</p>
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
                              Pago tardío de clase anterior
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (!effectiveCheckInWindowOpen) {
                                setError("La ventana de check-in para esta clase está cerrada.")
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
                              setNewBookingOverride({
                                courseSlug: bootstrap.context.courseSlug,
                                date: bootstrap.context.date,
                                time: bootstrap.context.time,
                              })
                              setOpenNewBooking(true)
                            }}
                            className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
                              effectiveCheckInWindowOpen
                                ? "bg-[var(--brand,#b61616)]"
                                : "bg-white/15"
                            }`}
                          >
                            {bootstrap.quickCheckout ? "Recompra" : "Comprar"}
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
                              Volver a la clase actual
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
            setOpenNewBooking(false)
            setNewBookingOverride(null)
          }}
          onExistingAccountDetectedAction={({ requiresLogin, phone, hasCompletedPurchase }) => {
            if (!hasCompletedPurchase) return
            setOpenNewBooking(false)
            setNewBookingOverride(null)
            setMode("existing")
            setError(null)
            setSuccess(null)
            setPendingLoginPhone(phone || "")
            if (requiresLogin || !isSignedIn) {
              setShowPhoneSignIn(true)
              return
            }
            void loadBootstrap()
          }}
          initialStep={0}
          flowVariant="checkin-new"
          completionMode={completionMode}
          checkInContext={newBookingContext}
          useDraft={false}
          mode="modal"
          onCompletedAction={isStationDeviceFlow ? handleStationCompletion : undefined}
        />
      )}

      {showPhoneSignIn && !isSignedIn && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[23rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Login rápido</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Ingresa con tu cuenta</h2>
                <p className="mt-1 text-sm text-white/68">Usa tu acceso para continuar con la recompra del curso actual.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneSignIn(false)}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <EmbeddedSignIn
                redirectUrl={existingEntryRedirectUrl}
                phoneNumber={toE164Phone(pendingLoginPhone)}
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
            setExistingRegularBookingOverride(null)
          }}
          initialStep={bootstrap?.quickCheckout ? 3 : 0}
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
