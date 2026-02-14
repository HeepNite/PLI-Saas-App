"use client"
import React from "react"
import Link from "next/link"
import CalendarPicker from "../ui/CalendarPicker"
import type { EnrollmentOption } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import {
  Calendar as CalendarIcon,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  CreditCard,
  Building2,
  User,
  FileText,
  CheckCircle2,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { CourseEnrollmentData, Coupon, EnrollmentContact, PaymentMethod } from "./types"
import { useEnrollDraft } from "./hooks/useEnrollDraft"
import { formatUSPhone, hasPhoneDigits, isCompleteUSPhone, toE164Phone } from "./utils/phone"
import { SignIn, useAuth, useUser } from "@clerk/nextjs"
import { StripePaymentModal } from "../payments/StripePaymentModal"
import { useRouter } from "next/navigation"

// EnrollModal: popup demo to select service, package, add-ons, date, time, and basic contact data.
// - This is a client-only component. It does not call a backend; instead, it logs the payload
//   and shows a local success state. Replace the `handleSubmit` implementation with a real API
//   call when you are ready.
// - All inputs are controlled in the local state for simplicity.

export default function EnrollModal({
  course,
  open,
  onCloseAction,
  initialStep,
  mode = "modal",
  prefillContact,
  useDraft = true,
}: {
  course: CourseEnrollmentData
  open: boolean
  onCloseAction: () => void
  initialStep?: number
  mode?: "modal" | "inline"
  prefillContact?: Partial<EnrollmentContact>
  useDraft?: boolean
}) {
  const { t } = useI18n()
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const isInline = mode === "inline"
  // Paso 0: opciones/servicios
  const [service, setService] = React.useState<string>(course.enrollment.services[0]?.id ?? "")
  const [pkg, setPkg] = React.useState<string>("")
  const [addons, setAddons] = React.useState<string[]>([])
  const [participants, setParticipants] = React.useState<number>(1)
  // Paso 1: fecha/hora
  const [date, setDate] = React.useState<string>("") // YYYY-MM-DD
  const [time, setTime] = React.useState<string>("") // HH:MM
  // Paso 3: pagos
  const [couponInput, setCouponInput] = React.useState<string>("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<Coupon>(null)
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("")
  // Paso 2: datos de contacto (modular, sin teléfono)
  const [contact, setContact] = React.useState<EnrollmentContact>(
    {
      firstName: "",
      lastName: "",
      email: "",
      phone: "+1 ",
      note: "",
    }
  )
  // Flujo multi‑paso + éxito
  const [step, setStep] = React.useState<number>(0)
  const [success, setSuccess] = React.useState<boolean>(false)
  const [processing, setProcessing] = React.useState<boolean>(false)
  const [timeLoading, setTimeLoading] = React.useState<boolean>(false)
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [requiresPhoneVerification, setRequiresPhoneVerification] = React.useState<boolean>(false)
  const [requiresSignIn, setRequiresSignIn] = React.useState<boolean>(false)
  const [pendingAutoPay, setPendingAutoPay] = React.useState<boolean>(false)
  const [phoneTouched, setPhoneTouched] = React.useState<boolean>(false)
  const [stripeClientSecret, setStripeClientSecret] = React.useState<string>("")
  const [showStripeModal, setShowStripeModal] = React.useState<boolean>(false)
  const prefillContactRef = React.useRef(prefillContact)
  const isNewStudent = service === "new-student"
  const returnTo = `/cursos/${course.slug}?enroll=1&step=2`
  const verifyPhoneUrl = `/verify-phone?return=${encodeURIComponent(returnTo)}`
  const steps = [
    { key: "party", label: t("step_party") },
    { key: "datetime", label: t("step_datetime") },
    { key: "info", label: t("step_info") },
    { key: "payments", label: t("step_payments") },
    { key: "review", label: t("step_review") },
  ] as const
  const stepIcons = {
    party: User,
    datetime: CalendarIcon,
    info: FileText,
    payments: CreditCard,
    review: CheckCircle2,
  }
  React.useEffect(() => {
    prefillContactRef.current = prefillContact
  }, [prefillContact])
  const signInReturnTo = `/cursos/${course.slug}?enroll=1&step=${Math.max(0, Math.min(steps.length - 1, step))}`
  const draftKey = React.useMemo(() => `pli-enroll:${course.slug}`, [course.slug])

  useEnrollDraft({
    open: useDraft ? open : false,
    success,
    draftKey,
    stepsCount: steps.length,
    state: {
      service,
      pkg,
      addons,
      participants,
      date,
      time,
      contact,
      couponInput,
      appliedCoupon,
      paymentMethod,
      step,
    },
    setters: {
      setService,
      setPkg,
      setAddons,
      setParticipants,
      setDate,
      setTime,
      setContact,
      setCouponInput,
      setAppliedCoupon,
      setPaymentMethod,
      setStep,
    },
  })

  React.useEffect(() => {
    if (!open || !prefillContact) return
    setContact((prev) => ({ ...prev, ...prefillContact }))
  }, [open, prefillContact])

  React.useEffect(() => {
    const id = window.setTimeout(() => setInitialLoading(false), 400)
    return () => window.clearTimeout(id)
  }, [])

  const resetForm = React.useCallback(() => {
    setSuccess(false)
    setAddons([])
    setParticipants(1)
    setDate("")
    setTime("")
    setContact({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" })
    setStep(0)
    setRequiresPhoneVerification(false)
    setRequiresSignIn(false)
    setPendingAutoPay(false)
    setPhoneTouched(false)
    setStripeClientSecret("")
    setShowStripeModal(false)
    setFormError(null)
    setProcessing(false)
  }, [])

  const handleClose = React.useCallback(() => {
    if (isInline) {
      resetForm()
      return
    }
    onCloseAction()
  }, [isInline, onCloseAction, resetForm])

  React.useEffect(() => {
    if (!open && !isInline) {
      resetForm()
    }
  }, [open, isInline, resetForm])

  React.useEffect(() => {
    if (isInline) return
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isInline])


  React.useEffect(() => {
    const serviceIds = course.enrollment.services.map((s) => s.id)
    setService((prev) => (serviceIds.includes(prev) ? prev : serviceIds[0] ?? ""))
    setPkg((prev) => (course.enrollment.packages.some((p) => p.id === prev) ? prev : ""))
    setAddons((prev) => prev.filter((id) => course.enrollment.addons?.some((a) => a.id === id)))
  }, [course.slug, course.enrollment.services, course.enrollment.packages, course.enrollment.addons])

  React.useEffect(() => {
    if (isNewStudent && participants !== 1) {
      setParticipants(1)
    }
  }, [isNewStudent, participants])

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (!open && !isInline) return
    const userPhone = user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber
    const formattedPhone = userPhone ? formatUSPhone(userPhone) : undefined
    setContact((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || "",
      lastName: prev.lastName || user.lastName || "",
      email: prev.email || user.primaryEmailAddress?.emailAddress || "",
      phone: hasPhoneDigits(prev.phone) ? prev.phone : formattedPhone || prev.phone,
    }))
  }, [isLoaded, isSignedIn, user, open, isInline])

  const initialServiceId = React.useMemo(() => course.enrollment.services[0]?.id ?? "", [course.enrollment.services])

  React.useEffect(() => {
    if (!open) return
    if (typeof window === "undefined") return
    const hasDraft = useDraft ? sessionStorage.getItem(draftKey) : null
    if (useDraft && hasDraft) return
    if (!useDraft) {
      sessionStorage.removeItem(draftKey)
    }
    setService(initialServiceId)
    setPkg("")
    setAddons([])
    setParticipants(1)
    setDate("")
    setTime("")
    setContact({
      firstName: "",
      lastName: "",
      email: "",
      phone: "+1 ",
      note: "",
      ...(prefillContactRef.current ?? {}),
    })
    setCouponInput("")
    setAppliedCoupon(null)
    setPaymentMethod("")
    setStep(0)
    setRequiresPhoneVerification(false)
    setRequiresSignIn(false)
    setPendingAutoPay(false)
    setPhoneTouched(false)
    setStripeClientSecret("")
    setShowStripeModal(false)
    setFormError(null)
  }, [open, course.slug, draftKey, useDraft, initialServiceId])

  // No early returns before hooks complete. We will conditionally render at the final return

  const findOpt = (arr: EnrollmentOption[], id: string) => arr.find((o) => o.id === id)
  const serviceOpt = findOpt(course.enrollment.services, service)
  const pkgOpt = findOpt(course.enrollment.packages, pkg)
  const addonsOpts = (course.enrollment.addons || []).filter((a) => addons.includes(a.id))
  const serviceBase = serviceOpt?.price || 0
  const packagePrice = pkgOpt?.price || 0
  const addonsTotal = addonsOpts.reduce((s, a) => s + (a.price || 0), 0)
  const serviceCharge = pkgOpt ? 0 : serviceBase
  const perPerson = serviceCharge + packagePrice + addonsTotal
  const subtotal = perPerson * Math.max(1, participants)
  const discount = appliedCoupon
    ? appliedCoupon.type === "percent"
      ? (subtotal * appliedCoupon.value) / 100
      : appliedCoupon.value
    : 0
  const total = Math.max(0, subtotal - discount)

  const formatPackageMeta = React.useCallback((option?: EnrollmentOption | null) => {
    if (!option?.meta) return option?.description
    const parts: string[] = []
    if (option.meta.cadence) parts.push(option.meta.cadence)
    if (option.meta.totalClasses && option.meta.totalClasses > 0) parts.push(`${option.meta.totalClasses} clases`)
    if (option.meta.makeUps && option.meta.makeUps > 0) parts.push(`+${option.meta.makeUps} make-ups`)
    return parts.join(" • ") || option.description
  }, [])

  // Helpers
  const to12h = (t: string) => {
    if (!t) return ""
    const [hStr, m] = t.split(":")
    let h = parseInt(hStr, 10)
    const ampm = h >= 12 ? "PM" : "AM"
    h = h % 12
    if (h === 0) h = 12
    return `${h}:${m} ${ampm}`
  }
  const TIME_SLOTS_24 = React.useMemo(() => {
    if (!date) return [] as readonly string[]

    const d = new Date(`${date}T00:00:00`)
    const weekday = (d.getDay() + 6) % 7 // Mon=0 ... Sun=6

    // Salsa evening: Mon/Thu 21:10, Tue/Fri 20:10, Sun 17:00
    if (course.slug === "salsa-nocturno") {
      if (weekday === 0 || weekday === 3) return ["21:10"] as const
      if (weekday === 1 || weekday === 4) return ["20:10"] as const
      if (weekday === 6) return ["17:00"] as const
      return [] as const
    }

    const base = course.schedule.availableTimes?.length
      ? (course.schedule.availableTimes as readonly string[])
      : (["10:00", "11:00", "18:00", "19:00", "20:00"] as const)

    return base
  }, [course.slug, course.schedule.availableTimes, date])

  // Calendar helpers (Google URL + ICS data URI)
  const eventDates = React.useMemo(() => {
    if (!date || !time) return null as null | { start: Date; end: Date }
    const start = new Date(`${date}T${time}:00`)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // 60 min default
    return { start, end }
  }, [date, time])

  const toUTCStamp = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(
      d.getUTCHours()
    ).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`

  const googleCalHref = React.useMemo(() => {
    if (!eventDates) return "#"
    const { start, end } = eventDates
    const text = `${course.title} — ${course.enrollment.services.find((s) => s.id === service)?.label || t("classWord")}`
    const details = t("googleCal_details", { participants, total: total.toFixed(2) })
    const location = course.location?.address || "Palladium Latin Institute"
    const dates = `${toUTCStamp(start)}/${toUTCStamp(end)}`
    const url = new URL("https://calendar.google.com/calendar/r/eventedit")
    url.searchParams.set("text", text)
    url.searchParams.set("details", details)
    url.searchParams.set("location", location)
    url.searchParams.set("dates", dates)
    return url.toString()
  }, [eventDates, course, service, participants, total, t])

  const icsDataUri = React.useMemo(() => {
    if (!eventDates) return "#"
    const { start, end } = eventDates
    const summary = `${course.title} — ${course.enrollment.services.find((s) => s.id === service)?.label || t("classWord")}`
    const description = t("ics_description", { participants, total: total.toFixed(2) })
    const location = course.location?.address || "Palladium Latin Institute"
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PLI//Booking Demo//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@pli.local`,
      `DTSTAMP:${toUTCStamp(new Date())}`,
      `DTSTART:${toUTCStamp(start)}`,
      `DTEND:${toUTCStamp(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
    const content = lines.join("\n")
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`
  }, [eventDates, course, service, participants, total, t])

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const validateBeforeSubmit = () => {
    if (!service || !course.enrollment.services.some((s) => s.id === service)) {
      return { step: 0, message: "Selecciona un servicio válido." }
    }
    if (pkg && !course.enrollment.packages.some((p) => p.id === pkg)) {
      return { step: 0, message: "El paquete elegido no es válido." }
    }
    if (participants < 1 || participants > 10) {
      return { step: 0, message: "El número de participantes no es válido." }
    }
    if (!date || !time) {
      return { step: 1, message: "Selecciona fecha y hora." }
    }
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      return { step: 2, message: "Completa tu nombre y apellido." }
    }
    if (!emailIsValid(contact.email)) {
      return { step: 2, message: "Ingresa un email válido." }
    }
    if (!isCompleteUSPhone(contact.phone)) {
      return { step: 2, message: "Ingresa un teléfono válido de EE. UU." }
    }
    if (paymentMethod !== "stripe" && paymentMethod !== "onsite") {
      return { step: 3, message: "Selecciona un método de pago." }
    }
    const addonsValid = addons.every((id) => course.enrollment.addons?.some((a) => a.id === id))
    if (!addonsValid) {
      return { step: 0, message: "Extras inválidos." }
    }
    if (!Number.isFinite(total) || total <= 0) {
      return { step: 0, message: "El monto calculado es inválido." }
    }
    return null
  }

  const requestStripeIntent = async (token?: string | null) => {
    const res = await fetch("/api/checkout/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        courseSlug: course.slug,
        courseTitle: course.title,
        amount: Math.round(total * 100),
        currency: "usd",
        date,
        time,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
        participants,
        addons,
        coupon: appliedCoupon?.code || undefined,
        packageId: pkg,
        serviceId: service,
        phone: contact.phone,
      }),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (processing) return
    setFormError(null)
    const validationIssue = validateBeforeSubmit()
    if (validationIssue) {
      setFormError(validationIssue.message)
      setStep(validationIssue.step)
      return
    }
    setProcessing(true)
    // DEMO: log payload; replace with POST /api/enroll when ready
    const payload = {
      course: course.slug,
      service,
      package: pkg,
      addons,
      date,
      time,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      email: contact.email,
      phone: contact.phone,
      note: contact.note,
      participants,
      coupon: appliedCoupon?.code || null,
      paymentMethod,
      total,
    }
    console.log("[EnrollModal] demo submit", payload)

    if (paymentMethod === "stripe") {
      try {
        let token = isSignedIn ? await getToken({ skipCache: true }) : null
        let result = await requestStripeIntent(token)

        const code = typeof result.data?.code === "string" ? result.data.code : undefined
        if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
          await new Promise((resolve) => window.setTimeout(resolve, 350))
          const refreshed = await getToken({ skipCache: true })
          if (refreshed) {
            token = refreshed
            result = await requestStripeIntent(token)
          }
        }

        if (!result.res.ok) {
          const finalCode = typeof result.data?.code === "string" ? result.data.code : undefined
          const needsSignIn = finalCode === "ACCOUNT_EXISTS"
          const isNewStudentBlocked =
            finalCode === "NEW_STUDENT_ALREADY" ||
            (typeof result.data?.error === "string" && result.data.error.toLowerCase().includes("new student price"))
          if (needsSignIn && isSignedIn) {
            setFormError(t("account_exists_signed_in"))
            setRequiresSignIn(false)
            setPendingAutoPay(false)
            setProcessing(false)
            return
          }
          if (isNewStudentBlocked) {
            setFormError(t("new_student_existing_error"))
            setRequiresPhoneVerification(false)
            setRequiresSignIn(false)
            setPendingAutoPay(false)
            setProcessing(false)
            setStep(0)
            return
          }
          const message =
            needsSignIn
              ? t("account_exists_error")
              : typeof result.data?.error === "string"
                ? result.data.error
                : "Error al iniciar el pago con Stripe."
          const needsPhoneVerification = message.toLowerCase().includes("phone verification")
          setFormError(needsSignIn ? null : message)
          setRequiresPhoneVerification(needsPhoneVerification)
          setRequiresSignIn(needsSignIn)
          setPendingAutoPay(needsSignIn)
          if (needsPhoneVerification) {
            router.push(verifyPhoneUrl)
          }
          setProcessing(false)
          return
        }
        if (!result.data.clientSecret) throw new Error("Missing client secret")
        setStripeClientSecret(result.data.clientSecret)
        setShowStripeModal(true)
        setRequiresPhoneVerification(false)
        setRequiresSignIn(false)
        setPendingAutoPay(false)
      } catch (err) {
        console.error(err)
        alert("No pudimos iniciar el pago. Intenta nuevamente.")
      } finally {
        setProcessing(false)
      }
      return
    }

    setSuccess(true)
    setProcessing(false)
  }

  const handleSubmitRef = React.useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit

  React.useEffect(() => {
    if (!pendingAutoPay || !isSignedIn || processing) return
    let cancelled = false
    let attempts = 0
    const run = async () => {
      const token = await getToken({ skipCache: true })
      if (cancelled) return
      if (!token) {
        attempts += 1
        if (attempts < 6) {
          window.setTimeout(run, 350)
        }
        return
      }
      setRequiresSignIn(false)
      setPendingAutoPay(false)
      void handleSubmitRef.current()
    }
    const timeout = window.setTimeout(run, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [pendingAutoPay, isSignedIn, processing, getToken])

  React.useEffect(() => {
    if (!requiresSignIn || !isSignedIn) return
    setRequiresSignIn(false)
  }, [requiresSignIn, isSignedIn])

  React.useEffect(() => {
    if (open && typeof initialStep === "number") {
      const safeStep = Math.max(0, Math.min(steps.length - 1, Math.floor(initialStep)))
      setStep(safeStep)
    }
  }, [open, initialStep, steps.length])

  const stepValid = (s: number) => {
    switch (s) {
      case 0:
        // Paquete ahora es opcional según pedido; solo servicio y participantes
        return participants >= 1 && course.enrollment.services.some((opt) => opt.id === service)
      case 1:
        return Boolean(date) && Boolean(time)
      case 2:
        return contact.firstName.trim().length > 1 && contact.email.trim().length > 5 && isCompleteUSPhone(contact.phone)
      case 3:
        return paymentMethod !== ""
      case 4:
        return true
      default:
        return false
    }
  }

  const canContinue = stepValid(step)

  if (!open && !isInline) return null

  return (
    <div
      role={isInline ? "region" : "dialog"}
      aria-modal={isInline ? undefined : true}
      aria-label={t("aria_dialog_bookingFor", { title: course.title })}
      className={
        isInline
          ? "w-full"
          : "fixed inset-0 z-[10000] flex items-stretch sm:items-center justify-center"
      }
    >
      {!isInline && (
        <button
          aria-label={t("aria_close")}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
      )}

      <GlassyCard
        data-lenis-prevent
        className={[
          "relative w-full bg-white/70 dark:bg-white/10 p-0",
          isInline
            ? "rounded-3xl overflow-hidden"
            : [
              "mx-0 sm:mx-4 sm:max-w-5xl lg:max-w-6xl h-full rounded-none sm:rounded-2xl",
              showStripeModal
                ? "sm:h-auto sm:min-h-[50rem] overflow-hidden"
                : "sm:h-auto overflow-y-auto",
            ].join(" "),
        ].join(" ")}
      >
        {!isInline && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            aria-label={t("aria_close")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
          </button>
        )}

        <div className={isInline ? "grid grid-cols-1 md:grid-cols-1" : "grid grid-cols-1 md:grid-cols-12"}>
          {/* Sidebar: stepper (form) OR calendar panel (success) */}
          <aside
            className={[
              "bg-neutral-900/90 text-white p-3 sm:p-4 space-y-3 sm:space-y-4",
              isInline ? "md:col-span-1" : "md:col-span-4 lg:col-span-3",
            ].join(" ")}
          >
            {success ? (
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold">{t("addToCalendar")}</h4>
                {eventDates ? (
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={googleCalHref}
                      target="_blank"
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarIcon className="h-4 w-4" aria-hidden />
                      Google
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarRange className="h-4 w-4" aria-hidden />
                      Outlook
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      Yahoo
                    </a>
                    <a
                      href={icsDataUri}
                      download={`pli-${course.slug}-${date}-${time}.ics`}
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2"
                    >
                      <CalendarCheck className="h-4 w-4" aria-hidden />
                      Apple
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-white/70">{t("calendarsHint")}</p>
                )}

                {/* Collapse menu eliminado por requerimiento */}
              </div>
            ) : (
              <>
                <h4 className="text-sm font-semibold">{t("booking")}</h4>
                {isInline ? (
                  <nav aria-label="Breadcrumb" className="mt-3">
                    {(() => {
                      const start = step <= 2 ? 0 : Math.max(steps.length - 3, 0)
                      const visible = steps.slice(start, start + 3)
                      const progressIndex = Math.max(0, Math.min(visible.length - 1, step - start))
                      const progressPct =
                        visible.length > 1 ? (progressIndex / (visible.length - 1)) * 100 : 0
                      const insetPct = 100 / (visible.length * 2)
                      return (
                        <div className="relative">
                          <div
                            className="absolute top-[18px] h-px bg-white/15"
                            style={{ left: `${insetPct}%`, right: `${insetPct}%` }}
                          />
                          <div
                            className="absolute top-[18px] h-px bg-[color:var(--brand)] transition-[width] duration-500 ease-out"
                            style={{
                              left: `${insetPct}%`,
                              width: `calc((100% - ${insetPct * 2}%) * ${progressPct / 100})`,
                            }}
                          />
                          <div className="relative z-10 grid grid-cols-3 gap-3">
                            {visible.map((st, idx) => {
                              const realIndex = start + idx
                              const done = realIndex < step && stepValid(realIndex)
                              const active = realIndex === step
                              const canJump = realIndex <= step
                              const Icon = stepIcons[st.key]
                              return (
                                <button
                                  key={st.key}
                                  type="button"
                                  onClick={() => {
                                    if (!canJump) return
                                    setStep(realIndex)
                                  }}
                                  disabled={!canJump}
                                  className={`flex flex-col items-center gap-2 text-[11px] transition ${
                                    canJump ? "hover:text-white" : "cursor-not-allowed opacity-60"
                                  }`}
                                  aria-label={st.label}
                                >
                                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/95">
                                    <span
                                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                        done
                                          ? "border-green-400/70 bg-green-500/20 text-green-200"
                                          : active
                                            ? "border-[color:var(--brand)] bg-[color:var(--brand)]/25 text-white"
                                            : "border-white/15 bg-white/5 text-white/50"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4" aria-hidden />
                                    </span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </nav>
                ) : (
                  <nav aria-label="Breadcrumb" className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                    {steps.map((st, idx) => {
                      const done = idx < step && stepValid(idx)
                      const active = idx === step
                      const canJump = idx <= step
                      return (
                        <React.Fragment key={st.key}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!canJump) return
                              setStep(idx)
                            }}
                            disabled={!canJump}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
                              active ? "border-white/40 bg-white/10" : "border-white/10 bg-transparent"
                            } ${canJump ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed"}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-green-400" : active ? "bg-white" : "bg-white/30"}`} />
                            <span>{st.label}</span>
                          </button>
                          {idx < steps.length - 1 && <span className="text-white/30">/</span>}
                        </React.Fragment>
                      )
                    })}
                  </nav>
                )}

                {/* Summary */}
                <div className="mt-4 rounded-md border border-white/10 p-3 text-xs hidden sm:block">
                  <div className="font-semibold mb-2">{t("summary")}</div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <div className="space-y-1">
                      <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                      <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</div>
                      {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                      <div>{t("people")}: {participants}</div>
                    </div>
                    <div className="space-y-1">
                      <div>{t("dateTime")}: {date || "—"} {to12h(time) || ""}</div>
                      <div>{t("email")}: {contact.email || "—"}</div>
                      <div className="pt-1">{t("total")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 sm:hidden">
                  <details className="rounded-md border border-white/10 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold list-none">{t("summary")}</summary>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="space-y-1">
                        <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                        <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</div>
                        {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                        <div>{t("people")}: {participants}</div>
                      </div>
                      <div className="space-y-1">
                        <div>{t("dateTime")}: {date || "—"} {to12h(time) || ""}</div>
                        <div>{t("email")}: {contact.email || "—"}</div>
                        <div className="pt-1">{t("total")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                      </div>
                    </div>
                  </details>
                </div>

                {/* Sin bloque de contacto; el chat vive en el UI global */}
              </>
            )}
          </aside>

          {/* Main content */}
          <section className={isInline ? "p-4 sm:p-6" : "md:col-span-8 lg:col-span-9 p-3 sm:p-6"}>
            <div className={isInline ? "" : "mx-auto w-full max-w-2xl"}>
              <div className="flex items-center gap-2 mb-3">
                {step > 0 && (
                  <button
                    type="button"
                    aria-label={t("back")}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="h-8 w-8 rounded-md border border-black/10 flex items-center justify-center"
                  >
                    ←
                  </button>
                )}
                <h3 className="text-xl sm:text-2xl font-semibold">{steps[step]?.label} • {course.title}</h3>
              </div>

            {success ? (
              <div className="mt-2">
                {/* Success header */}
                <div className="flex flex-col items-center py-4">
                  <div className="mb-2" aria-hidden>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">🎉</span>
                  </div>
                  <h3 className="text-xl font-semibold">{t("congratulations")}</h3>
                  <p className="text-xs text-neutral-500">{t("appointmentId")} {Math.abs((date+time).split("").reduce((a,c)=>a+c.charCodeAt(0),0)%1000) || 56}</p>
                </div>

                {/* Details table */}
                <div className="divide-y divide-black/10 dark:divide-white/10">
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("date")}</div>
                    <div className="text-right">{date}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("localTime")}</div>
                    <div className="text-right">{to12h(time)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("classWord")}:</div>
                    <div className="text-right">{course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("teacher")}</div>
                    <div className="text-right">{course.instructors?.[0]?.name || "—"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("location")}</div>
                    <div className="text-right">{course.location?.address}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-3 text-sm">
                    <div className="text-neutral-500">{t("payment")}</div>
                    <div className="text-right">${total.toFixed(2)} — {paymentMethod === "stripe" ? t("payments_stripe") : t("payments_onSite")}</div>
                  </div>
                </div>

                <hr className="my-3 border-black/10 dark:border-white/10" />

                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-neutral-500">{t("name")}:</div>
                    <div className="text-right">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-neutral-500">{t("email")}</div>
                    <div className="text-right">{contact.email}</div>
                  </div>
                </div>

                {/* Bottom bar actions */}
                <div className="mt-6 border-t border-black/10 dark:border-white/10 px-3 py-3 flex items-center justify-between">
                  <Link href="/panel" className="text-sm font-medium">{t("customerPanel")}</Link>
                  <button onClick={handleClose} className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white">{t("finish")}</button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e)=>{e.preventDefault(); if(step<steps.length-1){ setStep(step+1) } else { await handleSubmit() }}}
                className="space-y-4"
              >
                {/* Step contents */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_service")}</label>
                        <select
                          id="booking-service"
                          name="booking-service"
                          value={service}
                          onChange={(e) => setService(e.target.value)}
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2"
                        >
                          {course.enrollment.services.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}{s.price ? ` — $${s.price}` : ""}</option>
                          ))}
                        </select>
                      </fieldset>
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_companion")}</label>
                        <select
                          value={participants}
                          onChange={(e)=>setParticipants(parseInt(e.target.value)||1)}
                          disabled={isNewStudent}
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 disabled:opacity-60"
                        >
                          {[1,2,3,4].map(n=> <option key={n} value={n}>{n} {n===1?t("onePerson"):t("manyPeople")}</option>)}
                        </select>
                        {isNewStudent && (
                          <p className="text-xs text-neutral-500">{t("new_student_single_notice")}</p>
                        )}
                      </fieldset>
                    </div>

                    {/* Ofertas de paquetes (OPCIONAL) */}
                    {!!course.enrollment.packages.length && (
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{t("optionalPackages")}</h4>
                          {pkg && (
                            <button type="button" onClick={()=>setPkg("")} className="text-xs underline">
                              {t("removeSelection")}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t("packagesHint")}</p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {course.enrollment.packages.map((p) => {
                            const selected = pkg === p.id
                            const metaLine = formatPackageMeta(p)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setPkg(p.id)}
                                className={`rounded-md border px-3 py-3 text-left transition ${
                                  selected
                                    ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.12)] text-white"
                                    : "border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 text-neutral-700 dark:text-white/80 hover:border-white/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium">{p.label}</span>
                                  {p.price && <span className="text-sm font-semibold">${p.price}</span>}
                                </div>
                                {metaLine && (
                                  <p className="mt-1 text-xs text-neutral-500 dark:text-white/60">{metaLine}</p>
                                )}
                                {p.description && (
                                  <p className="mt-1 text-xs text-neutral-500 dark:text-white/60">{p.description}</p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {!!course.enrollment.addons?.length && (
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_extras")}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {course.enrollment.addons!.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggleAddon(a.id)} className="h-4 w-4" />
                              <span>{a.label}{a.price ? ` — $${a.price}` : ""}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4">
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("step_datetime")}</label>
                      {initialLoading ? (
                        <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
                          <div className="h-4 w-24 rounded-full shimmer" />
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 21 }).map((_, idx) => (
                              <div key={idx} className="h-8 rounded-md shimmer" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <CalendarPicker
                          value={date}
                          onChange={(d) => {
                            setDate(d)
                            if (!d) {
                              setTime("")
                              setTimeLoading(false)
                              return
                            }
                            setTime("")
                            setTimeLoading(true)
                            window.setTimeout(() => setTimeLoading(false), 350)
                          }}
                          className="w-full"
                          availableWeekdays={course.schedule.availableWeekdays}
                          allowClear
                        />
                      )}
                    </fieldset>
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_selectTime")}</label>
                      {date ? (
                        <div className="flex flex-wrap gap-2">
                          {timeLoading ? (
                            <>
                              <div className="h-9 w-24 rounded-md shimmer" />
                              <div className="h-9 w-24 rounded-md shimmer" />
                              <div className="h-9 w-24 rounded-md shimmer" />
                            </>
                          ) : (
                            <>
                              {(TIME_SLOTS_24 as readonly string[]).map((tSlot) => (
                                <button
                                  type="button"
                                  key={tSlot}
                                  onClick={()=>setTime(tSlot)}
                                  className={`px-3 py-1.5 rounded-md border text-sm ${time===tSlot?"bg-[var(--brand,#111)] text-white border-transparent":"border-black/10 dark:border-white/10"}`}
                                >
                                  {to12h(tSlot)}
                                </button>
                              ))}
                              {TIME_SLOTS_24.length === 0 && (
                                <p className="text-xs text-muted-foreground">No hay horarios disponibles para este día.</p>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">Selecciona una fecha para ver horarios disponibles.</p>
                          <div className="h-3 w-32 rounded-full shimmer" />
                          <div className="h-3 w-24 rounded-full shimmer" />
                        </div>
                      )}
                    </fieldset>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_firstName")}</label>
                      <input value={contact.firstName} onChange={(e)=>setContact((c)=>({...c, firstName: e.target.value}))} placeholder={t("placeholder_firstName")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">{t("label_lastName")}</label>
                      <input value={contact.lastName} onChange={(e)=>setContact((c)=>({...c, lastName: e.target.value}))} placeholder={t("placeholder_lastName")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">{t("label_email")}</label>
                    <input type="email" value={contact.email} onChange={(e)=>setContact((c)=>({...c, email: e.target.value}))} placeholder={t("placeholder_email")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                    <p className="text-xs text-neutral-500">
                      ¿Ya tienes cuenta?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setRequiresSignIn(true)
                          setPendingAutoPay(false)
                        }}
                        className="underline font-medium"
                      >
                        Inicia sesión
                      </button>{" "}
                      y se completan tus datos automáticamente.
                    </p>
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-2 text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                        US
                      </span>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => {
                          setPhoneTouched(true)
                          setContact((c) => ({ ...c, phone: formatUSPhone(e.target.value) }))
                        }}
                        onBlur={() => setPhoneTouched(true)}
                        placeholder="(929) 387-6584"
                        inputMode="tel"
                        autoComplete="tel"
                        aria-invalid={phoneTouched && !isCompleteUSPhone(contact.phone)}
                        className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2"
                      />
                    </div>
                    {phoneTouched && !isCompleteUSPhone(contact.phone) && (
                      <p className="text-xs text-red-600">{t("phone_format_hint")}</p>
                    )}
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">{t("label_notes")}</label>
                    <textarea value={contact.note} onChange={(e)=>setContact((c)=>({...c, note: e.target.value}))} rows={3} placeholder={t("placeholder_notes")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                  </fieldset>
                </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    {/* Payments step */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2">{t("payments_summary")}</h4>
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-3">
                        <div className="rounded-md border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-white/10">
                          <div className="text-xs text-neutral-500 mb-1">{t("payments_classes")}</div>
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              {course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}
                              {pkgOpt ? " (incluida en paquete)" : perPerson ? ` ($${perPerson.toFixed(2)})` : ""} × {participants} {participants===1?t("onePerson"):t("manyPeople")}
                            </span>
                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-neutral-500">
                            <div className="flex items-center justify-between">
                              <span>Servicio: {serviceOpt?.label || "—"}{pkgOpt ? " (incluida)" : ""}</span>
                              <span>${serviceCharge.toFixed(2)}</span>
                            </div>
                            {pkgOpt && (
                              <div className="flex items-center justify-between">
                                <span>
                                  Paquete: {pkgOpt.label}
                                  {formatPackageMeta(pkgOpt) ? ` (${formatPackageMeta(pkgOpt)})` : ""}
                                </span>
                                <span>${packagePrice.toFixed(2)}</span>
                              </div>
                            )}
                            {!!addonsOpts.length && (
                              <div className="flex items-center justify-between">
                                <span>Extras: {addonsOpts.map((a)=>a.label).join(", ")}</span>
                                <span>${addonsTotal.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span>Subtotal por persona</span>
                              <span>${perPerson.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium" htmlFor="coupon">{t("payments_coupon")}</label>
                          <input
                            id="coupon"
                            value={couponInput}
                            onChange={(e)=>setCouponInput(e.target.value)}
                            placeholder={t("payments_coupon_placeholder")}
                            className="flex-1 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                          />
                          {appliedCoupon ? (
                            <button
                              type="button"
                              onClick={()=>{ setAppliedCoupon(null); setCouponInput("") }}
                              className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                            >
                              {t("payments_remove")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={()=>{
                                const code = couponInput.trim().toUpperCase()
                                if (code === "PLI10") setAppliedCoupon({ code, type: "percent", value: 10 })
                                else if (code === "PLI20") setAppliedCoupon({ code, type: "percent", value: 20 })
                                else if (!code) return
                                else alert(t("payments_invalidCoupon"))
                              }}
                              className="rounded-md bg-[var(--brand,#111)] text-white px-3 py-2 text-sm"
                            >
                              {t("payments_add")}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="font-medium">{t("payments_totalAmount")}</span>
                          <span className="font-semibold">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">{t("payments_method")}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={()=>setPaymentMethod("onsite")}
                          className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod==="onsite"?"border-[var(--brand,#111)] bg-[var(--brand,#111)]/5":"border-black/10 dark:border-white/10"}`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <Building2 className="h-4 w-4" aria-hidden />
                            {t("payments_onSite")}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">{t("payments_onSite_desc")}</div>
                        </button>
                        <button
                          type="button"
                          onClick={()=>setPaymentMethod("stripe")}
                          className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod==="stripe"?"border-[var(--brand,#111)] bg-[var(--brand,#111)]/5":"border-black/10 dark:border-white/10"}`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <CreditCard className="h-4 w-4" aria-hidden />
                            {t("payments_stripe")}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">{t("payments_stripe_desc")}</div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <GlassyCard className="p-4">
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{t("reviewAndConfirm")}</div>
                        <div>{t("course")}: {course.title}</div>
                        <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}{pkgOpt ? " (incluida en paquete)" : ""}</div>
                        <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</div>
                        {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                        <div>{t("people")}: {participants}</div>
                        <div>{t("dateTime")}: {date} {to12h(time)}</div>
                        <div>{t("name")}: {`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
                        <div>{t("email")}: {contact.email || "—"}</div>
                        <div>Teléfono: {contact.phone || "—"}</div>
                        <div>{t("paymentMethod")}: {paymentMethod || "—"}</div>
                        {contact.note && <div>{t("notes")}: {contact.note}</div>}
                        <div className="pt-2">{t("estimatedTotal")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                      </div>
                    </GlassyCard>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10"
                  >
                    {t("cancel")}
                  </button>
                  <div className="flex gap-2">
                    <Link href="/panel" className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 hidden sm:inline">{t("myPanel")}</Link>
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                      className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 disabled:opacity-50"
                    >
                      {t("back")}
                    </button>
                    {step < steps.length - 1 ? (
                      <button
                        type="submit"
                        disabled={!canContinue}
                        className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"
                      >
                        {t("continue")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={processing}
                        className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"
                      >
                        {processing ? "Procesando..." : t("confirm")}
                      </button>
                    )}
                  </div>
                </div>
                {formError && <p className="text-sm text-red-600 mt-2" role="alert" aria-live="polite">{formError}</p>}
                {requiresPhoneVerification && (
                  <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                    <p>{t("new_student_verify_phone")}</p>
                    <Link href={verifyPhoneUrl} className="underline font-medium">{t("verify_phone_cta")}</Link>
                  </div>
                )}
              </form>
            )}
            </div>
          </section>
        </div>
        {showStripeModal && stripeClientSecret && (
          <StripePaymentModal
            clientSecret={stripeClientSecret}
            onClose={() => setShowStripeModal(false)}
            onSuccess={() => setSuccess(true)}
            email={contact.email}
            name={`${contact.firstName} ${contact.lastName}`.trim()}
            phone={contact.phone}
          />
        )}
      </GlassyCard>
      {requiresSignIn && (
        <div className="fixed inset-0 z-[10020] flex items-stretch justify-end px-2 sm:px-4 py-6">
          <button
            type="button"
            aria-label={t("aria_close")}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setRequiresSignIn(false)
              setPendingAutoPay(false)
            }}
          />
          <div className="relative z-10 w-full sm:max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {pendingAutoPay ? t("account_exists_title") : t("sign_in_modal_title")}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {pendingAutoPay ? t("account_exists_error") : t("sign_in_modal_subtitle")}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1 text-xs"
                onClick={() => {
                  setRequiresSignIn(false)
                  setPendingAutoPay(false)
                }}
              >
                {t("cancel")}
              </button>
            </div>
            <div className="mt-4">
              <SignIn
                routing="virtual"
                forceRedirectUrl={signInReturnTo}
                initialValues={{
                  phoneNumber: toE164Phone(contact.phone),
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
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="text-sm font-medium underline"
                onClick={() => {
                  setRequiresSignIn(false)
                  setPendingAutoPay(false)
                }}
              >
                {t("account_exists_back")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
