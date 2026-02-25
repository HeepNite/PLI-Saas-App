"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Image from "next/image"
import { SignIn, useAuth, useClerk, useUser } from "@clerk/nextjs"
import { StripePaymentModal } from "@/components/front/payments/StripePaymentModal"
import { demoCourses } from "@/constants/courses"
import { homeCourses } from "@/constants/home-content"
import EnrollModal from "@/components/front/courses/EnrollModal"
import { getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
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
const WALK_IN_LATE_GRACE_MINUTES = 20

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

const pickWalkInRecommendation = (referenceDate = new Date(), preferredCourseSlug = "") => {
  const todayIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  if (!todayIso) return null as null | { courseSlug: string; date: string; time: string }
  const nowMinutes = toMinutes(getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE))

  const preferredFamily = getCourseFamilyKey(preferredCourseSlug)
  const preferredCourses = preferredFamily
    ? demoCourses.filter((course) => getCourseFamilyKey(course.slug) === preferredFamily)
    : []
  const courseSets =
    preferredCourses.length > 0 && preferredCourses.length < demoCourses.length
      ? [preferredCourses, demoCourses]
      : [demoCourses]

  for (const courses of courseSets) {
    for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
      const dateIso = shiftIsoDate(todayIso, dayOffset)
      let bestForDay: null | { courseSlug: string; date: string; time: string; minutes: number } = null

      for (const course of courses) {
        const slots = sortTimes(getAvailableTimesForCourseDate(course.slug, dateIso))
        for (const slot of slots) {
          const slotMinutes = toMinutes(slot)
          if (slotMinutes === null) continue
          if (dayOffset === 0 && nowMinutes !== null && nowMinutes > slotMinutes + WALK_IN_LATE_GRACE_MINUTES) {
            continue
          }
          if (!bestForDay || slotMinutes < bestForDay.minutes) {
            bestForDay = {
              courseSlug: course.slug,
              date: dateIso,
              time: slot,
              minutes: slotMinutes,
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
  }

  return null
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

export default function CheckInQrClient() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useUser()
  const { getToken } = useAuth()
  const clerk = useClerk()
  const [nowTick, setNowTick] = React.useState<Date>(() => new Date())
  const [origin, setOrigin] = React.useState("")

  const qrCourseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()
  const qrDate = (searchParams.get("date") || "").trim()
  const qrTime = (searchParams.get("time") || "").trim()
  const durationMinutes = parseDuration(searchParams.get("durationMinutes"))
  const qrCourse = React.useMemo(
    () => demoCourses.find((course) => course.slug === qrCourseSlug) || null,
    [qrCourseSlug]
  )
  const walkInRecommendation = React.useMemo(
    () => pickWalkInRecommendation(nowTick, qrCourseSlug),
    [nowTick, qrCourseSlug]
  )
  const activeCourseSlug = walkInRecommendation?.courseSlug || qrCourseSlug
  const activeDate = walkInRecommendation?.date || qrDate
  const activeTime = walkInRecommendation?.time || qrTime
  const selectedCourse = React.useMemo(
    () => demoCourses.find((course) => course.slug === activeCourseSlug) || null,
    [activeCourseSlug]
  )
  const contextIsValid = Boolean(activeCourseSlug && activeDate && activeTime)
  const forceRedirectUrl = React.useMemo(() => {
    const query = searchParams.toString()
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
  const [showExistingPhonePrompt, setShowExistingPhonePrompt] = React.useState(false)
  const [showPhoneSignIn, setShowPhoneSignIn] = React.useState(false)
  const [pendingLoginPhone, setPendingLoginPhone] = React.useState("")
  const [pendingExistingRequiresLogin, setPendingExistingRequiresLogin] = React.useState(true)
  const [loadingBootstrap, setLoadingBootstrap] = React.useState(false)
  const [bootstrap, setBootstrap] = React.useState<BootstrapResponse | null>(null)
  const [openExistingRegularBooking, setOpenExistingRegularBooking] = React.useState(false)
  const [existingRegularBookingOverride, setExistingRegularBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [quickPayBusy, setQuickPayBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [stripeClientSecret, setStripeClientSecret] = React.useState("")
  const [showStripeModal, setShowStripeModal] = React.useState(false)
  const newBookingCourse = React.useMemo(
    () => demoCourses.find((course) => course.slug === (newBookingOverride?.courseSlug || "")) || selectedCourse || qrCourse,
    [newBookingOverride?.courseSlug, qrCourse, selectedCourse]
  )
  const newBookingContext = React.useMemo(
    () => ({
      date: newBookingOverride?.date || activeDate,
      time: newBookingOverride?.time || activeTime,
    }),
    [activeDate, activeTime, newBookingOverride?.date, newBookingOverride?.time]
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
    }),
    [activeDate, activeTime, existingRegularBookingOverride?.date, existingRegularBookingOverride?.time]
  )

  const checkInDisplayCourse = selectedCourse || qrCourse
  const checkInDisplayDate = activeDate
  const checkInDisplayTime = activeTime
  const checkInQrLink = React.useMemo(() => {
    if (!origin || !contextIsValid) return ""
    const params = new URLSearchParams()
    params.set("courseSlug", activeCourseSlug)
    params.set("date", activeDate)
    params.set("time", activeTime)
    params.set("durationMinutes", String(durationMinutes))
    return `${origin}${pathname}?${params.toString()}`
  }, [activeCourseSlug, activeDate, activeTime, contextIsValid, durationMinutes, origin, pathname])
  const checkInQrImage = React.useMemo(() => {
    if (!checkInQrLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(checkInQrLink)}`
  }, [checkInQrLink])
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
  const bootstrapCourseImage =
    bootstrapCourse?.heroMedia?.image || bootstrapCourse?.instructors?.[0]?.photo || "/images/hero-menu/live-academy.JPG"
  const legacyContextMissing = !qrCourseSlug || !qrDate || !qrTime
  const showContextWarning = !contextIsValid && legacyContextMissing
  const hideEntrySelection = mode === "existing" && isSignedIn

  const breadcrumbItems = React.useMemo(() => {
    const items = ["QR check-in"]
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
      } else if (openExistingRegularBooking) {
        items.push("Compra regular")
      }
    }
    return items
  }, [bootstrap?.quickCheckout, isSignedIn, loadingBootstrap, mode, openExistingRegularBooking, openNewBooking])

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
        setError(typeof data?.error === "string" ? data.error : "No pudimos preparar el flujo rápido.")
        return
      }
      setBootstrap(data as BootstrapResponse)
    } catch {
      setBootstrap(null)
      setError("No pudimos preparar el flujo rápido.")
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

  const startQuickPay = async () => {
    if (!bootstrap?.quickCheckout || !bootstrap?.customer) return
    if (!bootstrap.context.checkInWindow.isOpen) {
      setError("La ventana de check-in para este horario ya está cerrada.")
      return
    }
    setQuickPayBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const token = await getToken({ skipCache: true })
      const fullName = bootstrap.customer.name || `${bootstrap.customer.firstName} ${bootstrap.customer.lastName}`.trim()
      const res = await fetch("/api/checkout/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          courseSlug: bootstrap.context.courseSlug,
          courseTitle: bootstrap.context.courseTitle,
          amount: bootstrap.quickCheckout.amountCents,
          currency: bootstrap.quickCheckout.currency,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
          packageId: bootstrap.quickCheckout.packageId,
          serviceId: bootstrap.quickCheckout.serviceId,
          addons: bootstrap.quickCheckout.addons,
          participants: bootstrap.quickCheckout.participants,
          coupon: bootstrap.quickCheckout.coupon || undefined,
          email: bootstrap.customer.email,
          firstName: bootstrap.customer.firstName,
          lastName: bootstrap.customer.lastName,
          name: fullName,
          phone: bootstrap.customer.phone,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.clientSecret !== "string" || !data.clientSecret) {
        setError(typeof data?.error === "string" ? data.error : "No se pudo iniciar el pago rápido.")
        return
      }
      setStripeClientSecret(data.clientSecret)
      setShowStripeModal(true)
    } catch {
      setError("No se pudo iniciar el pago rápido.")
    } finally {
      setQuickPayBusy(false)
    }
  }

  const handleQuickPaymentSuccess = async (paymentIntentId?: string) => {
    const quickCheckout = bootstrap?.quickCheckout
    if (!paymentIntentId || !contextIsValid || !quickCheckout) {
      setError("No se pudo confirmar el pago para check-in.")
      return
    }
    try {
      const token = await getToken({ skipCache: true })
      const finalizeRes = await fetch("/api/checkout/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ paymentIntentId }),
      })
      const finalizeData = await finalizeRes.json().catch(() => null)
      if (!finalizeRes.ok) {
        setError(typeof finalizeData?.error === "string" ? finalizeData.error : "No se pudo sincronizar la compra.")
        return
      }

      const shouldCheckInWithPackage = Boolean(quickCheckout.packageId)
      const checkInEndpoint = shouldCheckInWithPackage ? "/api/checkin/qr/package" : "/api/checkin/qr/dropin"
      const checkInPayload = shouldCheckInWithPackage
        ? contextPayload
        : {
            ...contextPayload,
            paymentIntentId,
          }

      const dropinRes = await fetch(checkInEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(checkInPayload),
      })
      const dropinData = await dropinRes.json().catch(() => null)
      if (!dropinRes.ok) {
        setError(typeof dropinData?.error === "string" ? dropinData.error : "Pago confirmado, pero no se pudo registrar el check-in.")
        return
      }

      const pointsAwarded = typeof dropinData?.points?.awarded === "number" ? dropinData.points.awarded : 0
      setSuccess(
        pointsAwarded > 0
          ? `Pago y check-in completados. +${pointsAwarded} puntos.`
          : "Pago y check-in completados."
      )
      await loadBootstrap()
    } catch {
      setError("No se pudo completar el flujo rápido.")
    }
  }

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


  return (
    <main className="relative min-h-screen overflow-hidden bg-[#13141d] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)]" />
      <div className="relative mx-auto w-full max-w-4xl">
        <section className="rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.26),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-6 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.6)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">QR Check-in</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Ingreso de alumnos</h1>
          <p className="mt-2 text-sm text-white/70">
            {checkInDisplayCourse?.title || activeCourseSlug || qrCourseSlug || "Clase"} · {checkInDisplayDate || "sin fecha"} {checkInDisplayTime || ""}
          </p>
          <nav className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/55" aria-label="Breadcrumb">
            {breadcrumbItems.map((item, index) => (
              <React.Fragment key={`${item}-${index}`}>
                {index > 0 && <span className="text-white/35">/</span>}
                <span className={index === breadcrumbItems.length - 1 ? "text-white/80" : ""}>{item}</span>
              </React.Fragment>
            ))}
          </nav>

          {checkInQrImage && (
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
          {checkInQrImage && (
            <p className="mt-7 text-center text-lg font-semibold tracking-[0.14em] text-[var(--brand,#ff3f3f)]">
              o completa el proceso desde aqui mismo
            </p>
          )}

          {showContextWarning && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              El QR no tiene los datos completos. Usa un enlace con `courseSlug`, `date` y `time`.
            </div>
          )}

          {!hideEntrySelection && (
            <div className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("existing")
                  setError(null)
                  setSuccess(null)
                  if (!isSignedIn) {
                    setShowPhoneSignIn(true)
                  }
                }}
                className={`min-h-[112px] rounded-2xl border px-5 py-5 text-left ${
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
                  const resolvedCourse =
                    (walkInRecommendation
                      ? demoCourses.find((course) => course.slug === walkInRecommendation.courseSlug)
                      : null) || fallbackCourse
                  if (!resolvedCourse || (!contextIsValid && !walkInRecommendation)) {
                    setError("No pudimos abrir la compra porque faltan datos del QR.")
                    return
                  }
                  setNewBookingOverride({
                    courseSlug: resolvedCourse.slug,
                    date: walkInRecommendation?.date || activeDate,
                    time: walkInRecommendation?.time || activeTime,
                  })
                  setOpenNewBooking(true)
                }}
                className={`min-h-[112px] rounded-2xl border px-5 py-5 text-left ${
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
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr]">
                      <div className="relative h-44 bg-black/30 sm:h-full">
                        <Image
                          src={bootstrapCourseImage}
                          alt={bootstrap.context.courseTitle}
                          fill
                          sizes="(max-width: 640px) 100vw, 210px"
                          className="object-cover"
                        />
                      </div>
                      <div className="p-4 text-white/85">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/55">Curso actual</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{bootstrap.context.courseTitle}</h3>
                        <p className="mt-1 text-sm text-white/70">
                          {bootstrap.context.date} {bootstrap.context.time}
                        </p>
                        <p className="mt-2 text-xs text-white/65">
                          Ventana check-in: {toEsDateTime(bootstrap.context.checkInWindow.opensAt)} a{" "}
                          {toEsDateTime(bootstrap.context.checkInWindow.closesAt)}
                        </p>
                        {bootstrap.quickCheckout && (
                          <div className="mt-2 space-y-1 text-xs text-white/65">
                            <p>Servicio: {quickCheckoutDetails?.serviceLabel || bootstrap.quickCheckout.serviceId}</p>
                            {quickCheckoutDetails?.packageLabel && <p>Paquete: {quickCheckoutDetails.packageLabel}</p>}
                            {quickCheckoutDetails?.addonLabels && quickCheckoutDetails.addonLabels.length > 0 && (
                              <p>Extras: {quickCheckoutDetails.addonLabels.join(", ")}</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (bootstrap.quickCheckout) {
                              void startQuickPay()
                              return
                            }
                            if (bootstrap.hasAnyCompletedPurchase) {
                              setExistingRegularBookingOverride({
                                courseSlug: bootstrap.context.courseSlug,
                                date: bootstrap.context.date,
                                time: bootstrap.context.time,
                              })
                              setOpenExistingRegularBooking(true)
                              return
                            }
                            setNewBookingOverride({
                              courseSlug: bootstrap.context.courseSlug,
                              date: bootstrap.context.date,
                              time: bootstrap.context.time,
                            })
                            setOpenNewBooking(true)
                          }}
                          disabled={bootstrap.quickCheckout ? (!bootstrap.context.checkInWindow.isOpen || quickPayBusy) : false}
                          className="mt-4 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {bootstrap.quickCheckout ? (quickPayBusy ? "Preparando pago..." : "Recompra") : "Comprar"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">No pudimos cargar el flujo rápido.</p>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
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
            setPendingExistingRequiresLogin(Boolean(requiresLogin || !isSignedIn))
            setShowExistingPhonePrompt(true)
          }}
          initialStep={0}
          flowVariant="checkin-new"
          checkInContext={newBookingContext}
          useDraft={false}
          mode="modal"
        />
      )}

      {showExistingPhonePrompt && (
        <div className="fixed inset-0 z-[11990] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171922] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Usuario existente</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Número ya registrado</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowExistingPhonePrompt(false)}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70"
              >
                Cerrar
              </button>
            </div>
            <p className="mt-3 text-sm text-white/75">
              Este número de teléfono ya está registrado.
              {pendingExistingRequiresLogin
                ? " Por favor inicia sesión para continuar."
                : " Continuaremos con tu cuenta para mostrar el curso actual y la recompra."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExistingPhonePrompt(false)}
                className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/80"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExistingPhonePrompt(false)
                  setMode("existing")
                  if (pendingExistingRequiresLogin || !isSignedIn) {
                    setShowPhoneSignIn(true)
                    return
                  }
                  void loadBootstrap()
                }}
                className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
              >
                {pendingExistingRequiresLogin || !isSignedIn ? "Iniciar sesión" : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhoneSignIn && !isSignedIn && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171922] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Login rápido</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Ingresa con tu cuenta</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneSignIn(false)}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4">
              <SignIn
                routing="virtual"
                forceRedirectUrl={existingEntryRedirectUrl}
                initialValues={{
                  phoneNumber: toE164Phone(pendingLoginPhone),
                }}
                appearance={{
                  elements: {
                    card: "shadow-none bg-transparent p-0 w-full",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    footer: "hidden",
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {existingRegularBookingCourse && (
        <EnrollModal
          course={existingRegularBookingCourse}
          open={openExistingRegularBooking}
          onCloseAction={() => {
            setOpenExistingRegularBooking(false)
            setExistingRegularBookingOverride(null)
          }}
          initialStep={0}
          flowVariant="checkin-existing"
          checkInContext={existingRegularBookingContext}
          useDraft={false}
          mode="modal"
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

      {showStripeModal && stripeClientSecret && bootstrap && (
        <StripePaymentModal
          clientSecret={stripeClientSecret}
          onClose={() => setShowStripeModal(false)}
          onSuccess={handleQuickPaymentSuccess}
          email={bootstrap.customer.email}
          name={bootstrap.customer.name}
          phone={bootstrap.customer.phone}
        />
      )}
    </main>
  )
}
