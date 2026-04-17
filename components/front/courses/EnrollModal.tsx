"use client"
import React from "react"
import Link from "next/link"
import CalendarPicker from "../ui/CalendarPicker"
import { demoCourses, type CourseData, type EnrollmentOption } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import {
  Calendar as CalendarIcon,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  Camera,
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
import { useAuth, useUser } from "@clerk/nextjs"
import { StripePaymentModal } from "../payments/StripePaymentModal"
import { useRouter } from "next/navigation"
import { getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import ProfilePhotoCapture from "@/components/front/checkin/ProfilePhotoCapture"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import {
  getPhotoPolicy,
  isPhotoRequiredForAccount,
  type PhotoFlowContext,
} from "@/lib/checkin/photo-context-policy"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import {
  getCheckInSignInModalVariant,
  isCheckInContactGateStep,
  resolveEnrollInitialStep,
  resolveEnrollStepKeys,
  shouldIncludePhotoStep,
} from "@/lib/checkin/enroll-flow"
import {
  createEmptyKioskQrCheckoutState,
  getKioskPaymentTransitionRemainingMs,
  getKioskPaymentTransitionMessage,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  isKioskQrPendingPhase,
  KIOSK_QR_POLL_INTERVAL_MS,
  resolveKioskQrPhaseFromStatus,
  shouldAutoAdvanceKioskInfoStep,
  shouldMaskKioskInfoStep,
  shouldPauseKioskInactivityForQrPhase,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import {
  isRegularFallbackLocked,
  normalizePhoneKey,
  resolveCheckInServiceSelection,
} from "@/lib/checkin/new-student-flow"
import {
  INITIAL_KIOSK_NUMERIC_FIELD,
  PHONE_INPUT_ATTRIBUTES,
  selectKioskNumericField,
} from "@/lib/checkin/sign-in-inputs"
import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import {
  appendPhoneDigit,
  clearPhoneDigits,
  type KioskNumericField,
  removePhoneDigit,
} from "@/lib/checkin/numeric-keypad"

// EnrollModal: popup demo to select service, package, add-ons, date, time, and basic contact data.
// - This is a client-only component. It does not call a backend; instead, it logs the payload
//   and shows a local success state. Replace the `handleSubmit` implementation with a real API
//   call when you are ready.
// - All inputs are controlled in the local state for simplicity.

const CHECKIN_TIME_ZONE = "America/New_York"
const CHECKIN_LATE_GRACE_MINUTES = 20
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/

type EnrollFlowVariant = "default" | "checkin-new" | "checkin-existing"
type EnrollCompletionMode = "default" | "personal" | "station"

type EnrollCheckInContext = {
  date?: string
  time?: string
  durationMinutes?: number
}

type EnrollPrefillSelection = {
  service?: string
  packageId?: string
  addons?: string[]
  participants?: number
  paymentMethod?: PaymentMethod
}

type PreparedAccountState = {
  clerkUserId: string | null
  created: boolean
  requiresSignIn: boolean
  hasAvatar: boolean
}

type NewStudentVerifyResponse = {
  outcome?: "eligible" | "requires_sms_verification" | "fallback_regular"
  reason?: string
  message?: string
  eligibleForNewStudent?: boolean
  requiresSmsVerification?: boolean
  shouldFallbackToRegular?: boolean
}

type FlowPopupState = {
  title: string
  message: string
}

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return ISO_DATE_REGEX.test(trimmed) ? trimmed : ""
}

const normalizeTime24 = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return TIME_24_REGEX.test(trimmed) ? trimmed : ""
}

const normalizeDurationMinutes = (value: unknown) => {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) {
    return Math.max(15, Math.min(240, Math.round(parsed)))
  }
  return 60
}

const pad = (value: number) => String(value).padStart(2, "0")

const toMinutes = (time24: string) => {
  if (!TIME_24_REGEX.test(time24)) return null
  const [hour, minute] = time24.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const to12hLabel = (time24: string) => {
  const minutes = toMinutes(time24)
  if (minutes === null) return time24
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const ampm = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${pad(minute)} ${ampm}`
}

export const formatCheckInSummaryDateTime = (dateIso: string, time24: string, timeZone = CHECKIN_TIME_ZONE) => {
  const normalizedDate = normalizeIsoDate(dateIso)
  const normalizedTime = normalizeTime24(time24)
  if (!normalizedDate || !normalizedTime) return "—"

  const [year, month, day] = normalizedDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return `${normalizedDate} · ${to12hLabel(normalizedTime)}`
  }

  const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(stableDate)

  return `${dateLabel} · ${to12hLabel(normalizedTime)}`
}

const sortTime24 = (values: string[]) =>
  [...new Set(values.filter((value) => TIME_24_REGEX.test(value)))]
    .sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))

const shiftIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

const pickSlotForNow = (sortedSlots: string[], nowMinutes: number | null) => {
  if (!sortedSlots.length) return ""
  if (nowMinutes === null) return sortedSlots[0]
  for (const slot of sortedSlots) {
    const slotMinutes = toMinutes(slot)
    if (slotMinutes === null) continue
    if (nowMinutes <= slotMinutes + CHECKIN_LATE_GRACE_MINUTES) {
      return slot
    }
  }
  return ""
}

const isEligibleForTodayCheckIn = (slot: string, nowMinutes: number | null) => {
  if (nowMinutes === null) return true
  const slotMinutes = toMinutes(slot)
  if (slotMinutes === null) return false
  return nowMinutes <= slotMinutes + CHECKIN_LATE_GRACE_MINUTES
}

const findNextCourseSlot = (
  courseSlug: string,
  baseDateIso: string,
  nowMinutes: number | null,
  courses: CourseData[]
) => {
  for (let offset = 0; offset <= 14; offset += 1) {
    const dateIso = shiftIsoDate(baseDateIso, offset)
    const daySlots = sortTime24(getAvailableTimesForCourseDate(courseSlug, dateIso, courses))
    if (!daySlots.length) continue
    const candidates =
      offset === 0 ? daySlots.filter((slot) => isEligibleForTodayCheckIn(slot, nowMinutes)) : daySlots
    if (!candidates.length) continue
    const selected = offset === 0 ? pickSlotForNow(candidates, nowMinutes) || candidates[0] : candidates[0]
    if (selected) {
      return {
        date: dateIso,
        time: selected,
      }
    }
  }
  return null as null | { date: string; time: string }
}

const findNextDifferentCourseSlot = (
  courseSlug: string,
  dateIso: string,
  nowMinutes: number,
  courses: CourseData[]
) => {
  let candidate: { title: string; time: string; minutes: number } | null = null

  for (const possibleCourse of courses) {
    if (possibleCourse.slug === courseSlug) continue
    const slots = sortTime24(getAvailableTimesForCourseDate(possibleCourse.slug, dateIso, courses))
    for (const slot of slots) {
      const slotMinutes = toMinutes(slot)
      if (slotMinutes === null || slotMinutes <= nowMinutes) continue
      if (!candidate || slotMinutes < candidate.minutes) {
        candidate = {
          title: possibleCourse.title,
          time: slot,
          minutes: slotMinutes,
        }
      }
    }
  }

  return candidate
}

const computeCheckInAutofill = (
  courseSlug: string,
  courses: CourseData[],
  context?: EnrollCheckInContext,
  referenceDate = new Date()
) => {
  const nowDateIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  const nowTimeKey = getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  const nowMinutes = toMinutes(nowTimeKey)
  const contextDate = normalizeIsoDate(context?.date)
  const contextTime = normalizeTime24(context?.time)

  const todaySlots = nowDateIso ? sortTime24(getAvailableTimesForCourseDate(courseSlug, nowDateIso, courses)) : []
  const contextSlots = contextDate ? sortTime24(getAvailableTimesForCourseDate(courseSlug, contextDate, courses)) : []

  const contextIsValid =
    Boolean(contextDate && contextTime && contextSlots.includes(contextTime)) &&
    Boolean(
      !nowDateIso ||
        contextDate > nowDateIso ||
        (contextDate === nowDateIso && isEligibleForTodayCheckIn(contextTime, nowMinutes))
    )

  const nextSlotFromNow = nowDateIso ? findNextCourseSlot(courseSlug, nowDateIso, nowMinutes, courses) : null

  let targetDate = ""
  let targetTime = ""
  let notice: string | null = null

  if (contextIsValid && contextDate && contextTime) {
    targetDate = contextDate
    targetTime = contextTime
  } else if (nextSlotFromNow) {
    targetDate = nextSlotFromNow.date
    targetTime = nextSlotFromNow.time
  } else if (contextDate && contextSlots.length > 0) {
    targetDate = contextDate
    targetTime = contextTime && contextSlots.includes(contextTime) ? contextTime : contextSlots[0]
  } else if (todaySlots.length > 0 && nowDateIso) {
    targetDate = nowDateIso
    targetTime = pickSlotForNow(todaySlots, nowMinutes) || todaySlots[0]
  } else {
    targetDate = contextDate || nowDateIso || ""
    targetTime = contextTime || ""
  }

  if (!targetDate || !targetTime) {
    return {
      date: targetDate,
      time: targetTime,
      notice: null as string | null,
    }
  }

  if (nowDateIso && nowMinutes !== null && targetDate !== nowDateIso && todaySlots.length > 0) {
    const hasAvailableTodaySlot = todaySlots.some((slot) => isEligibleForTodayCheckIn(slot, nowMinutes))
    if (!hasAvailableTodaySlot) {
      const nextDifferentCourse = findNextDifferentCourseSlot(courseSlug, nowDateIso, nowMinutes, courses)
      if (nextDifferentCourse) {
        notice = `A schedule is available later: ${nextDifferentCourse.title} at ${to12hLabel(nextDifferentCourse.time)}.`
      }
    }
  }

  return {
    date: targetDate,
    time: targetTime,
    notice,
  }
}

const normalizeEnrollPhonePrefill = (value?: string) => {
  if (typeof value !== "string" || value.trim().length === 0) return "+1 "
  return formatUSPhone(value)
}

export default function EnrollModal({
  course,
  open,
  onCloseAction,
  onCompletedAction,
  onPaymentsStepReadyAction,
  onTimeoutAction,
  initialStep,
  mode = "modal",
  prefillContact,
  prefillHasAvatar,
  prefillSelection,
  flowVariant = "default",
  completionMode = "default",
  photoFlowContext = "external_web",
  checkInContext,
  kioskSessionToken,
  useDraft = true,
}: {
  course: CourseEnrollmentData
  open: boolean
  onCloseAction: () => void
  onCompletedAction?: () => void | Promise<void>
  /**
   * Called once when the modal reaches the payments step for the first time
   * after opening. Used by the kiosk terminal flow to know when to hide the
   * full-screen resolving overlay.
   */
  onPaymentsStepReadyAction?: () => void
  /**
   * Called when the inactivity timeout fires instead of onCompletedAction.
   * Use to reset to a different state (e.g. idle chooser) on timeout.
   */
  onTimeoutAction?: () => void
  initialStep?: number
  mode?: "modal" | "inline"
  prefillContact?: Partial<EnrollmentContact>
  prefillHasAvatar?: boolean
  prefillSelection?: EnrollPrefillSelection
  flowVariant?: EnrollFlowVariant
  completionMode?: EnrollCompletionMode
  photoFlowContext?: PhotoFlowContext
  checkInContext?: EnrollCheckInContext
  kioskSessionToken?: string
  useDraft?: boolean
}) {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const { t } = useI18n()
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const isInline = mode === "inline"
  const checkInContextDate = normalizeIsoDate(checkInContext?.date)
  const checkInContextTime = normalizeTime24(checkInContext?.time)
  const checkInContextDuration = normalizeDurationMinutes(checkInContext?.durationMinutes)
  const isCheckInNewFlow = flowVariant === "checkin-new"
  const isCheckInFlow = flowVariant === "checkin-new" || flowVariant === "checkin-existing"
  const isCheckInExistingFlow = flowVariant === "checkin-existing"
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"
  const isStationCompletion = isCheckInFlow && completionMode === "station"
  const isPersonalCompletion = isCheckInFlow && completionMode === "personal"
  const photoPolicy = React.useMemo(() => getPhotoPolicy(photoFlowContext), [photoFlowContext])
  const allowPanelAccess = !isCheckInFlow
  const availableServices = React.useMemo(
    () =>
      isCheckInExistingFlow
        ? course.enrollment.services.filter((item) => item.id !== "new-student")
        : course.enrollment.services,
    [course.enrollment.services, isCheckInExistingFlow]
  )
  const hasNewStudentService = React.useMemo(
    () => course.enrollment.services.some((item) => item.id === "new-student"),
    [course.enrollment.services]
  )
  const courseAvailableWeekdays = React.useMemo(
    () =>
      course.schedule?.availableWeekdays ||
      sourceCourses.find((item) => item.slug === course.slug)?.schedule.availableWeekdays,
    [course.schedule?.availableWeekdays, course.slug, sourceCourses]
  )
  const forcedNewStudentServiceId = hasNewStudentService
    ? "new-student"
    : (availableServices[0]?.id ?? "")
  // Paso 0: opciones/servicios
  const [service, setService] = React.useState<string>(availableServices[0]?.id ?? "")
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
  const [studentPin, setStudentPin] = React.useState("")
  const [studentPinConfirm, setStudentPinConfirm] = React.useState("")
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
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [processing, setProcessing] = React.useState<boolean>(false)
  const [timeLoading, setTimeLoading] = React.useState<boolean>(false)
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [requiresSignIn, setRequiresSignIn] = React.useState<boolean>(false)
  const [existingAccountDetected, setExistingAccountDetected] = React.useState<boolean>(false)
  const [resumeAfterSignInStep, setResumeAfterSignInStep] = React.useState<number | null>(null)
  const [pendingAutoPay, setPendingAutoPay] = React.useState<boolean>(false)
  const [resumeContactFlowAfterSignIn, setResumeContactFlowAfterSignIn] = React.useState<boolean>(false)
  const [identityCheckBusy, setIdentityCheckBusy] = React.useState<boolean>(false)
  const [phoneTouched, setPhoneTouched] = React.useState<boolean>(false)
  const [stripeClientSecret, setStripeClientSecret] = React.useState<string>("")
  const [showStripeModal, setShowStripeModal] = React.useState<boolean>(false)
  const [kioskQrCheckout, setKioskQrCheckout] = React.useState<KioskQrCheckoutState>(
    () => createEmptyKioskQrCheckoutState()
  )
  const [preparedAccount, setPreparedAccount] = React.useState<PreparedAccountState | null>(null)
  const [photoSaved, setPhotoSaved] = React.useState<boolean>(false)
  const [activeNumericField, setActiveNumericField] = React.useState<KioskNumericField>(INITIAL_KIOSK_NUMERIC_FIELD)
  const [newStudentFallbackPhoneKey, setNewStudentFallbackPhoneKey] = React.useState<string | null>(null)
  const [flowPopup, setFlowPopup] = React.useState<FlowPopupState | null>(null)
  const [signInPurpose, setSignInPurpose] = React.useState<"existing" | "sms_verification" | "account_preparation">("existing")
  const [checkInScheduleNotice, setCheckInScheduleNotice] = React.useState<string | null>(null)
  const [checkInNow, setCheckInNow] = React.useState<Date>(() => new Date())
  const [kioskStepHydrating, setKioskStepHydrating] = React.useState(false)
  const [showKioskPaymentTransition, setShowKioskPaymentTransition] = React.useState(false)
  const stationCompletionTimeoutRef = React.useRef<number | null>(null)
  const kioskPaymentTransitionTimeoutRef = React.useRef<number | null>(null)
  const kioskPaymentTransitionStartedAtRef = React.useRef<number | null>(null)
  const openInitializationRef = React.useRef(false)
  const prefillContactRef = React.useRef(prefillContact)
  const prefillSelectionRef = React.useRef(prefillSelection)
  const kioskFastPathAdvanceTriggeredRef = React.useRef(false)
  const kioskFastPathSubmitTriggeredRef = React.useRef(false)
  const userContactRef = React.useRef<Partial<EnrollmentContact>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+1 ",
    note: "",
  })
  const isNewStudent = service === "new-student"
  const accountHasAvatar = Boolean(prefillHasAvatar || preparedAccount?.hasAvatar || photoSaved)
  const requiresPhotoStep = React.useMemo(
    () =>
      shouldIncludePhotoStep({
        isCheckInFlow,
        photoPolicyRequired: photoPolicy.photoRequired,
        hasAvatar: accountHasAvatar,
        photoSaved,
      }),
    [accountHasAvatar, isCheckInFlow, photoPolicy.photoRequired, photoSaved]
  )
  const stepKeys = React.useMemo(
    () =>
      resolveEnrollStepKeys({
        isCheckInFlow,
        isCheckInNewFlow,
        isKioskTerminalFlow,
        requiresPhotoStep,
      }),
    [isCheckInFlow, isCheckInNewFlow, isKioskTerminalFlow, requiresPhotoStep]
  )
  const steps = React.useMemo(
    () =>
      stepKeys.map((key) => ({
        key,
        label:
          key === "party"
            ? t("step_party")
            : key === "datetime"
              ? t("step_datetime")
              : key === "info"
                ? t("step_info")
                : key === "payments"
                  ? t("step_payments")
                  : key === "review"
                    ? t("step_review")
                    : "Photo",
      })),
    [stepKeys, t]
  )
  const stepIcons: Record<string, typeof User> = {
    party: User,
    datetime: CalendarIcon,
    info: FileText,
    photo: Camera,
    payments: CreditCard,
    review: CheckCircle2,
  }
  const regularServiceId = React.useMemo(
    () =>
      availableServices.find((item) => item.id !== "new-student")?.id ||
      availableServices[0]?.id ||
      "",
    [availableServices]
  )
  const paymentsStepIndex = React.useMemo(
    () => steps.findIndex((item) => item.key === "payments"),
    [steps]
  )
  const photoStepIndex = React.useMemo(
    () => steps.findIndex((item) => item.key === "photo"),
    [steps]
  )
  const regularServicePrice = React.useMemo(
    () => availableServices.find((item) => item.id === regularServiceId)?.price || 20,
    [availableServices, regularServiceId]
  )
  const regularFallbackLocked = React.useMemo(
    () => isRegularFallbackLocked(newStudentFallbackPhoneKey, contact.phone),
    [contact.phone, newStudentFallbackPhoneKey]
  )
  const effectiveInitialStep = React.useMemo(
    () => resolveEnrollInitialStep({ initialStep, stepsLength: steps.length }),
    [initialStep, steps.length]
  )
  const signInModalVariant = React.useMemo(
    () => getCheckInSignInModalVariant(isCheckInFlow),
    [isCheckInFlow]
  )
  const kioskPaymentTransitionMessage = React.useMemo(
    () => getKioskPaymentTransitionMessage(contact.firstName),
    [contact.firstName]
  )
  React.useEffect(() => {
    prefillContactRef.current = prefillContact
  }, [prefillContact])

  React.useEffect(() => {
    prefillSelectionRef.current = prefillSelection
  }, [prefillSelection])

  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    setCheckInNow(new Date())
    const intervalId = window.setInterval(() => setCheckInNow(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [isCheckInFlow, open])

  React.useEffect(() => {
    if (open) return
    openInitializationRef.current = false
    setKioskStepHydrating(false)
  }, [open])

  React.useEffect(() => {
    const userPhone = user?.primaryPhoneNumber?.phoneNumber || user?.phoneNumbers?.[0]?.phoneNumber
    userContactRef.current = {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
      phone: userPhone ? formatUSPhone(userPhone) : "+1 ",
      note: "",
    }
  }, [
    user?.firstName,
    user?.lastName,
    user?.phoneNumbers,
    user?.primaryEmailAddress?.emailAddress,
    user?.primaryPhoneNumber?.phoneNumber,
  ])
  const signInReturnTo = `/courses/${course.slug}?enroll=1&step=${Math.max(0, Math.min(steps.length - 1, step))}`
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
    if (isCheckInNewFlow) return
    if (!open || !prefillContact) return
    setContact((prev) => ({
      ...prev,
      ...prefillContact,
      phone:
        typeof prefillContact.phone === "string"
          ? normalizeEnrollPhonePrefill(prefillContact.phone)
          : prev.phone,
    }))
  }, [isCheckInNewFlow, open, prefillContact])

  React.useEffect(() => {
    const id = window.setTimeout(() => setInitialLoading(false), 400)
    return () => window.clearTimeout(id)
  }, [])

  const resetForm = React.useCallback(() => {
    if (kioskPaymentTransitionTimeoutRef.current !== null) {
      window.clearTimeout(kioskPaymentTransitionTimeoutRef.current)
      kioskPaymentTransitionTimeoutRef.current = null
    }
    setSuccess(false)
    setSuccessMessage(null)
    setAddons([])
    setParticipants(1)
    setDate("")
    setTime("")
    setContact({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" })
    setStep(0)
    setCheckInScheduleNotice(null)
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
    setResumeContactFlowAfterSignIn(false)
    setIdentityCheckBusy(false)
    setPhoneTouched(false)
    setStripeClientSecret("")
    setShowStripeModal(false)
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
    setPreparedAccount(null)
    setPhotoSaved(false)
    setStudentPin("")
    setStudentPinConfirm("")
    setActiveNumericField(null)
    setNewStudentFallbackPhoneKey(null)
    setFlowPopup(null)
    setSignInPurpose("existing")
    setFormError(null)
    setProcessing(false)
    setShowKioskPaymentTransition(false)
    kioskPaymentTransitionStartedAtRef.current = null
    kioskFastPathAdvanceTriggeredRef.current = false
    kioskFastPathSubmitTriggeredRef.current = false
  }, [])

  const handleClose = React.useCallback(() => {
    resetForm()
    onCloseAction()
  }, [onCloseAction, resetForm])

  React.useEffect(() => {
    return () => {
      if (stationCompletionTimeoutRef.current !== null) {
        window.clearTimeout(stationCompletionTimeoutRef.current)
        stationCompletionTimeoutRef.current = null
      }
      if (kioskPaymentTransitionTimeoutRef.current !== null) {
        window.clearTimeout(kioskPaymentTransitionTimeoutRef.current)
        kioskPaymentTransitionTimeoutRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (!open && !isInline) {
      resetForm()
    }
  }, [open, isInline, resetForm])

  React.useEffect(() => {
    if (!success || !isStationCompletion || !onCompletedAction) return
    if (stationCompletionTimeoutRef.current !== null) {
      window.clearTimeout(stationCompletionTimeoutRef.current)
    }
    stationCompletionTimeoutRef.current = window.setTimeout(() => {
      stationCompletionTimeoutRef.current = null
      void onCompletedAction()
    }, 10_000)
    return () => {
      if (stationCompletionTimeoutRef.current !== null) {
        window.clearTimeout(stationCompletionTimeoutRef.current)
        stationCompletionTimeoutRef.current = null
      }
    }
  }, [isStationCompletion, onCompletedAction, success])

  React.useEffect(() => {
    if (
      !open ||
      !isStationCompletion ||
      (!onCompletedAction && !onTimeoutAction) ||
      success ||
      shouldPauseKioskInactivityForQrPhase(kioskQrCheckout.phase)
    ) {
      return
    }

    const timeoutAction = onTimeoutAction ?? onCompletedAction
    const controller = createKioskInactivityController({
      onTimeout: () => {
        void timeoutAction?.()
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
  }, [isStationCompletion, kioskQrCheckout.phase, onCompletedAction, onTimeoutAction, open, success])

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
    const serviceIds = availableServices.map((s) => s.id)
    setService((prev) => {
      return resolveCheckInServiceSelection({
        previousService: prev,
        availableServiceIds: serviceIds,
        isCheckInNewFlow,
        hasNewStudentService,
        regularFallbackLocked,
      })
    })
    setPkg((prev) => (course.enrollment.packages.some((p) => p.id === prev) ? prev : ""))
    setAddons((prev) => prev.filter((id) => course.enrollment.addons?.some((a) => a.id === id)))
  }, [
    course.slug,
    availableServices,
    course.enrollment.packages,
    course.enrollment.addons,
    isCheckInNewFlow,
    hasNewStudentService,
    regularFallbackLocked,
  ])

  React.useEffect(() => {
    if (isNewStudent && participants !== 1) {
      setParticipants(1)
    }
  }, [isNewStudent, participants])

  React.useEffect(() => {
    if (!isCheckInFlow) return
    setPreparedAccount(null)
    setPhotoSaved(false)
  }, [
    contact.email,
    contact.firstName,
    contact.lastName,
    contact.phone,
    isCheckInFlow,
    service,
  ])

  React.useEffect(() => {
    if (!isCheckInNewFlow || !open || !hasNewStudentService) return
    if (regularFallbackLocked) return
    if (service !== "new-student") {
      setService("new-student")
    }
  }, [hasNewStudentService, isCheckInNewFlow, open, regularFallbackLocked, service])

  React.useEffect(() => {
    if (isCheckInNewFlow) return
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
  }, [isCheckInNewFlow, isLoaded, isSignedIn, user, open, isInline])

  const initialServiceId = React.useMemo(() => {
    if (isCheckInNewFlow) return forcedNewStudentServiceId
    if (isCheckInExistingFlow) return regularServiceId
    return availableServices[0]?.id ?? ""
  }, [availableServices, forcedNewStudentServiceId, isCheckInExistingFlow, isCheckInNewFlow, regularServiceId])

  React.useEffect(() => {
    if (!open) return
    if (typeof window === "undefined") return
    if (openInitializationRef.current) return
    const hasDraft = useDraft ? sessionStorage.getItem(draftKey) : null
    if (useDraft && hasDraft) {
      openInitializationRef.current = true
      setKioskStepHydrating(false)
      return
    }
    setKioskStepHydrating(isKioskTerminalFlow && isCheckInExistingFlow)
    if (!useDraft) {
      sessionStorage.removeItem(draftKey)
    }
    openInitializationRef.current = true
    const userContact = userContactRef.current
    const initialContact: EnrollmentContact = isCheckInNewFlow
      ? {
          firstName: "",
          lastName: "",
          email: "",
          phone: "+1 ",
          note: "",
        }
        : {
            firstName: prefillContactRef.current?.firstName ?? userContact.firstName ?? "",
            lastName: prefillContactRef.current?.lastName ?? userContact.lastName ?? "",
            email: prefillContactRef.current?.email ?? userContact.email ?? "",
            phone: normalizeEnrollPhonePrefill(prefillContactRef.current?.phone ?? userContact.phone),
            note: prefillContactRef.current?.note ?? "",
          }
    const checkInAutofill = isCheckInFlow
      ? computeCheckInAutofill(course.slug, sourceCourses, {
          date: checkInContextDate,
          time: checkInContextTime,
        })
      : { date: "", time: "", notice: null as string | null }
    const nextService =
      prefillSelectionRef.current?.service &&
      availableServices.some((item) => item.id === prefillSelectionRef.current?.service)
        ? prefillSelectionRef.current.service
        : initialServiceId
    const nextPackage =
      prefillSelectionRef.current?.packageId &&
      course.enrollment.packages.some((item) => item.id === prefillSelectionRef.current?.packageId)
        ? prefillSelectionRef.current.packageId
        : ""
    const nextAddons = (prefillSelectionRef.current?.addons || []).filter((id) =>
      course.enrollment.addons?.some((item) => item.id === id)
    )
    const nextParticipants =
      typeof prefillSelectionRef.current?.participants === "number" &&
      Number.isFinite(prefillSelectionRef.current.participants)
        ? Math.max(1, Math.min(10, Math.round(prefillSelectionRef.current.participants)))
        : 1
    setService(nextService)
    setPkg(nextPackage)
    setAddons(nextAddons)
    setParticipants(nextParticipants)
    setDate(checkInAutofill.date)
    setTime(checkInAutofill.time)
    setContact(initialContact)
    setCouponInput("")
    setAppliedCoupon(null)
    setPaymentMethod(prefillSelectionRef.current?.paymentMethod || "")
    setStep(effectiveInitialStep)
    setCheckInScheduleNotice(checkInAutofill.notice)
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
    setIdentityCheckBusy(false)
    setPhoneTouched(false)
    setStripeClientSecret("")
    setShowStripeModal(false)
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
    setFormError(null)
    kioskFastPathAdvanceTriggeredRef.current = false
    kioskFastPathSubmitTriggeredRef.current = false
    setKioskStepHydrating(false)
  }, [
    open,
    course.slug,
    draftKey,
    useDraft,
    initialServiceId,
    availableServices,
    course.enrollment.addons,
    course.enrollment.packages,
    isCheckInNewFlow,
    isCheckInFlow,
    isCheckInExistingFlow,
    isKioskTerminalFlow,
    checkInContextDate,
    checkInContextTime,
    effectiveInitialStep,
    sourceCourses,
  ])

  // No early returns before hooks complete. We will conditionally render at the final return

  const findOpt = (arr: EnrollmentOption[], id: string) => arr.find((o) => o.id === id)
  const serviceOpt = findOpt(availableServices, service)
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
  const hideCalendarSidebar = Boolean(success && isCheckInFlow)
  const paymentMethodLabel =
    paymentMethod === "stripe"
      ? t("payments_stripe")
      : paymentMethod === "onsite"
        ? t("payments_onSite")
        : "—"
  const summaryGridClass = isKioskTerminalFlow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 sm:gap-4"
  const kioskQrCheckoutPending = isKioskQrPendingPhase(kioskQrCheckout.phase)
  const kioskQrCheckoutLocked = isKioskTerminalFlow && (kioskQrCheckout.phase === "creating" || kioskQrCheckoutPending)

  const renderSummaryItem = React.useCallback(
    (label: string, value: React.ReactNode) => (
      <div className="break-words">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</div>
        <div className="mt-1 whitespace-normal break-words text-white/85">{value}</div>
      </div>
    ),
    []
  )

  const formatPackageMeta = React.useCallback((option?: EnrollmentOption | null) => {
    if (!option?.meta) return option?.description
    const parts: string[] = []
    if (option.meta.cadence) parts.push(option.meta.cadence)
    if (option.meta.totalClasses && option.meta.totalClasses > 0) parts.push(`${option.meta.totalClasses} classes`)
    if (option.meta.makeUps && option.meta.makeUps > 0) parts.push(`+${option.meta.makeUps} make-ups`)
    return parts.join(" • ") || option.description
  }, [])

  const getCurrentCourseTimesForDate = React.useCallback((dateIso: string) => {
    if (course.slug === "salsa-nocturno") {
      return sortTime24(getAvailableTimesForCourseDate(course.slug, dateIso, sourceCourses))
    }
    const dateValue = normalizeIsoDate(dateIso)
    if (!dateValue) return [] as string[]
    const parsedDate = new Date(`${dateValue}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return [] as string[]
    const weekdayMon = (parsedDate.getDay() + 6) % 7
    const weekdays = Array.isArray(course.schedule?.availableWeekdays) ? course.schedule.availableWeekdays : []
    const times = Array.isArray(course.schedule?.availableTimes) ? course.schedule.availableTimes : []
    if (!weekdays.length || !times.length) {
      return sortTime24(getAvailableTimesForCourseDate(course.slug, dateValue, sourceCourses))
    }
    if (!weekdays.includes(weekdayMon)) return [] as string[]
    return sortTime24(times)
  }, [course.schedule?.availableTimes, course.schedule?.availableWeekdays, course.slug, sourceCourses])

  // Helpers
  const to12h = (value: string) => to12hLabel(value)
  const formattedSummaryDateTime = React.useMemo(
    () => formatCheckInSummaryDateTime(date, time),
    [date, time]
  )
  const summaryDateTimeValue = isKioskTerminalFlow
    ? formattedSummaryDateTime
    : <>{date || "—"} {to12h(time) || ""}</>
  const checkInTodayIso = React.useMemo(
    () => getDateKeyInTimeZone(checkInNow, CHECKIN_TIME_ZONE),
    [checkInNow]
  )
  const checkInNowMinutes = React.useMemo(
    () => toMinutes(getTimeKeyInTimeZone(checkInNow, CHECKIN_TIME_ZONE)),
    [checkInNow]
  )
  const TIME_SLOTS_24 = React.useMemo(() => {
    if (!date) return [] as readonly string[]
    return getCurrentCourseTimesForDate(date)
  }, [date, getCurrentCourseTimesForDate])
  const visibleTimeSlots = React.useMemo(() => {
    if (!isCheckInFlow) return TIME_SLOTS_24 as readonly string[]
    if (time) return [time] as const
    if (TIME_SLOTS_24.length > 0) return [TIME_SLOTS_24[0]] as const
    return [] as const
  }, [isCheckInFlow, time, TIME_SLOTS_24])

  const isSlotExpiredForCheckIn = React.useCallback((slot: string) => {
    if (!isCheckInFlow || !date || date !== checkInTodayIso) return false
    if (checkInNowMinutes === null) return false
    const slotMinutes = toMinutes(slot)
    if (slotMinutes === null) return false
    return checkInNowMinutes > slotMinutes + CHECKIN_LATE_GRACE_MINUTES
  }, [isCheckInFlow, date, checkInTodayIso, checkInNowMinutes])

  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    const recommended = computeCheckInAutofill(
      course.slug,
      sourceCourses,
      {
        date: checkInContextDate,
        time: checkInContextTime,
      },
      checkInNow
    )
    if (recommended.date && recommended.date !== date) {
      setDate(recommended.date)
    }
    if (recommended.time !== time) {
      setTime(recommended.time)
    }
    if (recommended.notice !== checkInScheduleNotice) {
      setCheckInScheduleNotice(recommended.notice)
    }
  }, [
    isCheckInFlow,
    open,
    course.slug,
    checkInContextDate,
    checkInContextTime,
    checkInNow,
    date,
    time,
    checkInScheduleNotice,
    sourceCourses,
  ])

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

  const emailIsValid = React.useCallback((value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), [])

  const validateBeforeSubmit = () => {
    if (!service || !availableServices.some((s) => s.id === service)) {
      return { step: 0, message: "Select a valid service." }
    }
    if (pkg && !course.enrollment.packages.some((p) => p.id === pkg)) {
      return { step: 0, message: "The selected package is invalid." }
    }
    if (participants < 1 || participants > 10) {
      return { step: 0, message: "The number of participants is invalid." }
    }
    if (!date || !time) {
      return { step: 1, message: "Select date and time." }
    }
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      return { step: 2, message: "Complete your first and last name." }
    }
    if (!emailIsValid(contact.email)) {
      return { step: 2, message: "Enter a valid email." }
    }
    if (!isCompleteUSPhone(contact.phone)) {
      return { step: 2, message: "Enter a valid US phone number." }
    }
    if (paymentMethod !== "stripe" && paymentMethod !== "onsite") {
      return { step: paymentsStepIndex >= 0 ? paymentsStepIndex : 3, message: "Select a payment method." }
    }
    if (service === "new-student") {
      if (!/^\d{4}$/.test(studentPin)) {
        return { step: steps.length - 1, message: "Create a 4-digit PIN to continue." }
      }
      if (studentPin !== studentPinConfirm) {
        return { step: steps.length - 1, message: "PIN confirmation does not match." }
      }
    }
    const addonsValid = addons.every((id) => course.enrollment.addons?.some((a) => a.id === id))
    if (!addonsValid) {
      return { step: 0, message: "Invalid extras." }
    }
    if (!Number.isFinite(total) || total <= 0) {
      return { step: 0, message: "Calculated amount is invalid." }
    }
    return null
  }

  const buildCheckoutPayload = React.useCallback(
    (extra: Record<string, unknown> = {}) => ({
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
      photoContext: photoFlowContext,
      kioskSessionToken: kioskSessionToken || undefined,
      studentPin: service === "new-student" ? studentPin : undefined,
      studentPinConfirm: service === "new-student" ? studentPinConfirm : undefined,
      ...extra,
    }),
    [
      addons,
      appliedCoupon?.code,
      contact.email,
      contact.firstName,
      contact.lastName,
      contact.phone,
      course.slug,
      course.title,
      date,
      participants,
      photoFlowContext,
      pkg,
      kioskSessionToken,
      service,
      studentPin,
      studentPinConfirm,
      time,
      total,
    ]
  )

  const requestNewStudentOutcome = React.useCallback(async () => {
    const res = await fetch("/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        phone: contact.phone,
      }),
    })
    const contentType = res.headers.get("content-type") || ""
    const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null

    if (!res.ok || !data || typeof data.outcome !== "string") {
      setFormError(
        typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "We couldn't verify the customer's phone."
      )
      return null
    }

    return data as NewStudentVerifyResponse
  }, [contact.phone])

  const requestAccountPreparation = React.useCallback(async () => {
    const res = await fetch("/api/checkout/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(buildCheckoutPayload({ prepareOnly: true })),
    })
    const data = await res.json().catch(() => null)
    const account = data?.account as PreparedAccountState | undefined

    if (!res.ok || !account || typeof account.hasAvatar !== "boolean") {
      setFormError(
        typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "We couldn't prepare the customer account."
      )
      return null
    }

    setPreparedAccount(account)
    return account
  }, [buildCheckoutPayload])

  const showRegularFallbackPopup = React.useCallback(
    (message?: string) => {
      const nextFallbackPhoneKey = normalizePhoneKey(contact.phone)
      if (nextFallbackPhoneKey) {
        setNewStudentFallbackPhoneKey(nextFallbackPhoneKey)
      }
      if (regularServiceId && regularServiceId !== service) {
        setService(regularServiceId)
      }
      setFlowPopup({
        title: "Regular price applied",
        message:
          message ||
          `We switched this booking to the regular $${regularServicePrice.toFixed(0)} price. Continue without restarting the flow.`,
      })
    },
    [contact.phone, regularServiceId, regularServicePrice, service]
  )

  const advanceFromContactStep = React.useCallback(async () => {
    if (!isCheckInFlow) {
      setStep(step + 1)
      return
    }

    setIdentityCheckBusy(true)
    setFormError(null)
    try {
      if (service === "new-student" && isCompleteUSPhone(contact.phone)) {
        const verification = await requestNewStudentOutcome()
        if (!verification) return

        if (verification.shouldFallbackToRegular || verification.outcome === "fallback_regular") {
          showRegularFallbackPopup(verification.message)
          return
        }

        if (verification.requiresSmsVerification || verification.outcome === "requires_sms_verification") {
          const account = await requestAccountPreparation()
          if (!account) return

          if (!isSignedIn || account.requiresSignIn) {
            setSignInPurpose("sms_verification")
            setRequiresSignIn(true)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setResumeContactFlowAfterSignIn(true)
            return
          }

          const verifiedAgain = await requestNewStudentOutcome()
          if (!verifiedAgain || !(verifiedAgain.eligibleForNewStudent || verifiedAgain.outcome === "eligible")) {
            showRegularFallbackPopup(verifiedAgain?.message)
            return
          }
        }
      }

      const account = preparedAccount || (await requestAccountPreparation())
      if (!account) return

      if (photoPolicy.uploadMode === "customer_self" && account.requiresSignIn && !isSignedIn) {
        setSignInPurpose("account_preparation")
        setRequiresSignIn(true)
        setExistingAccountDetected(false)
        setResumeAfterSignInStep(null)
        setPendingAutoPay(false)
        setResumeContactFlowAfterSignIn(true)
        return
      }

      const needsPhoto = isPhotoRequiredForAccount(photoPolicy, Boolean(account.hasAvatar || photoSaved))
      if (needsPhoto && photoStepIndex >= 0) {
        setStep(photoStepIndex)
        return
      }

      if (paymentsStepIndex >= 0) {
        setStep(paymentsStepIndex)
        return
      }
    } finally {
      setIdentityCheckBusy(false)
    }
  }, [
    contact.phone,
    isCheckInFlow,
    isSignedIn,
    paymentsStepIndex,
    photoPolicy,
    photoSaved,
    photoStepIndex,
    preparedAccount,
    requestAccountPreparation,
    requestNewStudentOutcome,
    service,
    showRegularFallbackPopup,
    step,
  ])

  const requestStripeIntent = async (token?: string | null) => {
    const res = await fetch("/api/checkout/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(buildCheckoutPayload()),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  const requestKioskCheckoutSession = React.useCallback(async (token?: string | null) => {
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(buildCheckoutPayload()),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }, [buildCheckoutPayload])

  const requestCashCheckout = async (token?: string | null) => {
    const res = await fetch("/api/checkout/cash", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(buildCheckoutPayload({ cashNote: contact.note || undefined })),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  const resetKioskQrCheckout = React.useCallback(() => {
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
  }, [])

  const completeDropInCheckInAfterCardPayment = React.useCallback(
    async ({ paymentIntentId, purchaseId }: { paymentIntentId?: string | null; purchaseId?: string | null }) => {
      if (!isCheckInFlow) return null
      if (pkg || !date || !time) {
        return "Purchase recorded successfully."
      }

      const resolvedPaymentIntentId = typeof paymentIntentId === "string" && paymentIntentId.trim().length > 0
        ? paymentIntentId
        : null
      const resolvedPurchaseId = typeof purchaseId === "string" && purchaseId.trim().length > 0 ? purchaseId : null

      if (!resolvedPaymentIntentId && !resolvedPurchaseId) {
        return "Payment was completed, but check-in sync is still pending."
      }

      try {
        const dropInRes = await fetch("/api/checkin/qr/dropin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...(resolvedPaymentIntentId ? { paymentIntentId: resolvedPaymentIntentId } : {}),
            ...(resolvedPurchaseId ? { purchaseId: resolvedPurchaseId } : {}),
            courseSlug: course.slug,
            date,
            time,
            durationMinutes: checkInContextDuration,
          }),
        })
        const dropInData = await dropInRes.json().catch(() => null)
        return dropInRes.ok
          ? "Purchase and check-in recorded successfully."
          : typeof dropInData?.error === "string"
            ? `Purchase recorded. Automatic check-in could not be completed: ${dropInData.error}`
            : "Purchase recorded. Automatic check-in could not be completed."
      } catch (error) {
        console.warn("Unable to complete automatic drop-in check-in", error)
        return "Payment was completed, but we couldn't confirm automatic check-in."
      }
    },
    [checkInContextDuration, course.slug, date, isCheckInFlow, pkg, time]
  )

  const startKioskQrCheckout = React.useCallback(async () => {
    setKioskQrCheckout((prev) => ({
      ...createEmptyKioskQrCheckoutState(),
      phase: "creating",
      error: prev.error,
    }))

    let token = isSignedIn ? await getToken({ skipCache: true }) : null
    let result = await requestKioskCheckoutSession(token)
    const code = typeof result.data?.code === "string" ? result.data.code : undefined

    if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      const refreshed = await getToken({ skipCache: true })
      if (refreshed) {
        token = refreshed
        result = await requestKioskCheckoutSession(token)
      }
    }

    if (!result.res.ok) {
      const message =
        typeof result.data?.error === "string" && result.data.error.trim().length > 0
          ? result.data.error
          : "Error starting QR checkout."
      setKioskQrCheckout({
        ...createEmptyKioskQrCheckoutState(),
        phase: "error",
        error: message,
      })
      setFormError(message)
      return false
    }

    if (typeof result.data?.url !== "string" || typeof result.data?.sessionId !== "string") {
      const message = "Checkout session is missing required data."
      setKioskQrCheckout({
        ...createEmptyKioskQrCheckoutState(),
        phase: "error",
        error: message,
      })
      setFormError(message)
      return false
    }

    setFormError(null)
    setKioskQrCheckout({
      phase: "qr_ready",
      sessionId: result.data.sessionId,
      url: result.data.url,
      expiresAt: typeof result.data?.expiresAt === "string" ? result.data.expiresAt : null,
      awaitingWebhook: false,
      purchaseId: null,
      paymentStatus: null,
      error: null,
    })
    return true
  }, [getToken, isSignedIn, requestKioskCheckoutSession])

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

    if (paymentMethod === "stripe" && isKioskTerminalFlow) {
      try {
        await startKioskQrCheckout()
      } catch (err) {
        console.error(err)
        setKioskQrCheckout({
          ...createEmptyKioskQrCheckoutState(),
          phase: "error",
          error: "We couldn't start the QR payment. Please try again.",
        })
        alert("We couldn't start the QR payment. Please try again.")
      } finally {
        setProcessing(false)
      }
      return
    }

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
          const needsSignIn = !isCheckInFlow && finalCode === "ACCOUNT_EXISTS"
          const isNewStudentBlocked =
            finalCode === "NEW_STUDENT_ALREADY" ||
            (typeof result.data?.error === "string" && result.data.error.toLowerCase().includes("new student price"))
          const needsPhoneFallback =
            isCheckInFlow &&
            typeof result.data?.error === "string" &&
            result.data.error.toLowerCase().includes("phone verification")
          if (needsSignIn && isSignedIn) {
            setFormError(t("account_exists_signed_in"))
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            return
          }
          if (isNewStudentBlocked) {
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            showRegularFallbackPopup(
              `This customer is not eligible for the new-student price. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
            )
            return
          }
          if (needsPhoneFallback) {
            setRequiresSignIn(false)
            setExistingAccountDetected(false)
            setResumeAfterSignInStep(null)
            setPendingAutoPay(false)
            setProcessing(false)
            showRegularFallbackPopup(
              `Phone verification was not completed. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
            )
            return
          }
          const message =
            needsSignIn
              ? t("account_exists_error")
              : typeof result.data?.error === "string"
                ? result.data.error
                : "Error starting card payment."
          setFormError(needsSignIn ? null : message)
          setRequiresSignIn(needsSignIn)
          setExistingAccountDetected(needsSignIn)
          setResumeAfterSignInStep(needsSignIn ? (paymentsStepIndex >= 0 ? paymentsStepIndex : step) : null)
          setPendingAutoPay(needsSignIn)
          setProcessing(false)
          return
        }
        if (!result.data.clientSecret) throw new Error("Missing client secret")
        setStripeClientSecret(result.data.clientSecret)
        setShowStripeModal(true)
        setRequiresSignIn(false)
        setExistingAccountDetected(false)
        setResumeAfterSignInStep(null)
        setPendingAutoPay(false)
      } catch (err) {
        console.error(err)
        alert("We couldn't start the payment. Please try again.")
      } finally {
        setProcessing(false)
      }
      return
    }

    try {
      let token = isSignedIn ? await getToken({ skipCache: true }) : null
      let result = await requestCashCheckout(token)
      const code = typeof result.data?.code === "string" ? result.data.code : undefined

      if (result.res.status === 409 && code === "ACCOUNT_EXISTS" && isSignedIn) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
        const refreshed = await getToken({ skipCache: true })
        if (refreshed) {
          token = refreshed
          result = await requestCashCheckout(token)
        }
      }

      if (!result.res.ok) {
        const isNewStudentBlocked =
          code === "NEW_STUDENT_ALREADY" ||
          (typeof result.data?.error === "string" && result.data.error.toLowerCase().includes("new student price"))
        const message =
          typeof result.data?.error === "string" && result.data.error.trim().length > 0
            ? result.data.error
            : "Unable to register cash payment."
        const needsPhoneFallback = isCheckInFlow && message.toLowerCase().includes("phone verification")
        const needsSignIn = !isCheckInFlow && code === "ACCOUNT_EXISTS"
        if (isNewStudentBlocked || needsPhoneFallback) {
          setRequiresSignIn(false)
          setExistingAccountDetected(false)
          setResumeAfterSignInStep(null)
          setPendingAutoPay(false)
          setProcessing(false)
          showRegularFallbackPopup(
            isNewStudentBlocked
              ? `This customer is not eligible for the new-student price. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
              : `Phone verification was not completed. We switched the booking to the regular $${regularServicePrice.toFixed(0)} price.`
          )
          return
        }
        setFormError(needsSignIn ? null : message)
        setRequiresSignIn(needsSignIn)
        setExistingAccountDetected(needsSignIn)
        setResumeAfterSignInStep(needsSignIn ? (paymentsStepIndex >= 0 ? paymentsStepIndex : step) : null)
        setPendingAutoPay(needsSignIn)
        setProcessing(false)
        return
      }

      let completionMessage =
        typeof result.data?.migration?.message === "string" && result.data.migration.message.trim().length > 0
          ? result.data.migration.message
          : "Cash request saved as pending confirmation."

      if (isCheckInFlow && !pkg && date && time && typeof result.data?.purchaseId === "string") {
        try {
          const dropInRes = await fetch("/api/checkin/qr/dropin", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({
              purchaseId: result.data.purchaseId,
              courseSlug: course.slug,
              date,
              time,
              durationMinutes: checkInContextDuration,
            }),
          })
          const dropInData = await dropInRes.json().catch(() => null)
          completionMessage = dropInRes.ok
            ? "Cash payment recorded and check-in completed successfully."
            : typeof dropInData?.error === "string"
              ? `Cash payment recorded. Automatic check-in could not be completed: ${dropInData.error}`
              : "Cash payment recorded. Automatic check-in could not be completed."
        } catch (error) {
          console.warn("Unable to complete automatic check-in for cash", error)
          completionMessage = "Cash payment recorded, but automatic check-in could not be completed."
        }
      }

      if (!isCheckInFlow && !isSignedIn && result.data?.account?.requiresSignIn) {
        completionMessage =
          "Cash request saved as pending confirmation. Sign in later to save your card and speed up future checkouts."
      } else if (!isCheckInFlow && result.data?.paymentStatus === "pending") {
        completionMessage = "Cash request saved. Staff must confirm the payment in admin before class access."
      }

      setSuccessMessage(completionMessage)
      setSuccess(true)
      setRequiresSignIn(false)
      setExistingAccountDetected(false)
      setResumeAfterSignInStep(null)
      setPendingAutoPay(false)
    } catch (err) {
      console.error(err)
      alert("We couldn't register the cash payment. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleFormStepSubmit = async () => {
    if (step < steps.length - 1) {
      if (isCheckInContactGateStep({ isCheckInFlow, activeStepKey })) {
        await advanceFromContactStep()
        return
      }
      setStep(step + 1)
      return
    }
    await handleSubmit()
  }

  const handleSubmitRef = React.useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit
  const advanceFromContactStepRef = React.useRef(advanceFromContactStep)
  advanceFromContactStepRef.current = advanceFromContactStep

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
    if (!isSignedIn) return

    if (requiresSignIn) {
      setRequiresSignIn(false)
    }

    if (existingAccountDetected) {
      setExistingAccountDetected(false)
    }

    if (resumeAfterSignInStep !== null) {
      if (service === "new-student" && regularServiceId && regularServiceId !== service) {
        setService(regularServiceId)
      }
      const safeStep = Math.max(0, Math.min(steps.length - 1, resumeAfterSignInStep))
      setStep(safeStep)
      setResumeAfterSignInStep(null)
      setFormError(null)
    }

    if (resumeContactFlowAfterSignIn) {
      setResumeContactFlowAfterSignIn(false)
      void advanceFromContactStepRef.current()
    }
  }, [
    existingAccountDetected,
    isSignedIn,
    regularServiceId,
    requiresSignIn,
    resumeContactFlowAfterSignIn,
    resumeAfterSignInStep,
    service,
    steps.length,
  ])

  React.useEffect(() => {
    if (!open) return
    setStep((prev) => Math.max(0, Math.min(prev, steps.length - 1)))
  }, [open, steps.length])

  const activeStepKey = steps[step]?.key || ""
  const kioskInfoFastPathEligible = isKioskInfoFastPathEligible({
    isKioskTerminalFlow,
    isCheckInExistingFlow,
    date,
    time,
    contact,
  })
  const kioskCardFastPathEligible = isKioskCardFastPathEligible({
    isKioskTerminalFlow,
    isCheckInExistingFlow,
    paymentMethod,
    date,
    time,
    contact,
  })
  const kioskInfoTransitionPending = kioskInfoFastPathEligible && !kioskFastPathAdvanceTriggeredRef.current
  const kioskInfoAutoAdvanceReady = shouldAutoAdvanceKioskInfoStep({
    isKioskTerminalFlow,
    isCheckInExistingFlow,
    date,
    time,
    contact,
    activeStepKey,
    open,
    processing,
    identityCheckBusy,
    requiresSignIn,
    hasError: Boolean(formError),
  })
  const shouldMaskKioskInfoContent = shouldMaskKioskInfoStep({
    isKioskTerminalFlow,
    isCheckInExistingFlow,
    activeStepKey,
    open,
    requiresSignIn,
    hasError: Boolean(formError),
    hydrating: kioskStepHydrating,
    transitionPending: kioskInfoTransitionPending,
  })

  // Track whether we already fired onPaymentsStepReadyAction for this open session
  const paymentsReadyFiredRef = React.useRef(false)

  // Notify the parent (e.g. CheckInQrClient) once payments is the active step
  // AND the internal kiosk transition overlay has cleared. This lets the
  // outer full-screen resolving overlay stay up until the payment UI is truly
  // visible — not just until the EnrollModal has been opened.
  React.useEffect(() => {
    if (!open) {
      paymentsReadyFiredRef.current = false
      return
    }
    if (paymentsReadyFiredRef.current) return
    if (activeStepKey !== "payments") return
    if (showKioskPaymentTransition) return
    paymentsReadyFiredRef.current = true
    onPaymentsStepReadyAction?.()
  }, [activeStepKey, onPaymentsStepReadyAction, open, showKioskPaymentTransition])

  React.useEffect(() => {
    if (kioskPaymentTransitionTimeoutRef.current !== null) {
      window.clearTimeout(kioskPaymentTransitionTimeoutRef.current)
      kioskPaymentTransitionTimeoutRef.current = null
    }

    if (!open) {
      setShowKioskPaymentTransition(false)
      kioskPaymentTransitionStartedAtRef.current = null
      return
    }

    if (!showKioskPaymentTransition) {
      return
    }

    if (activeStepKey === "info") {
      return
    }

    const startedAt = kioskPaymentTransitionStartedAtRef.current ?? Date.now()
    const remaining = getKioskPaymentTransitionRemainingMs(startedAt)
    kioskPaymentTransitionTimeoutRef.current = window.setTimeout(() => {
      setShowKioskPaymentTransition(false)
      kioskPaymentTransitionStartedAtRef.current = null
      kioskPaymentTransitionTimeoutRef.current = null
    }, remaining)
  }, [activeStepKey, open, showKioskPaymentTransition])

  React.useEffect(() => {
    if (!isKioskTerminalFlow || !open || activeStepKey !== "info") {
      setActiveNumericField(null)
      return
    }
  }, [activeStepKey, isKioskTerminalFlow, open])

  React.useEffect(() => {
    if (!kioskInfoAutoAdvanceReady) return
    if (kioskFastPathAdvanceTriggeredRef.current) return

    kioskPaymentTransitionStartedAtRef.current = Date.now()
    setShowKioskPaymentTransition(true)
    kioskFastPathAdvanceTriggeredRef.current = true
    void advanceFromContactStepRef.current()
  }, [
    kioskInfoAutoAdvanceReady,
  ])

  React.useEffect(() => {
    if (!open) return
    if (!isKioskTerminalFlow) return
    if (!kioskCardFastPathEligible) return
    if (!kioskFastPathAdvanceTriggeredRef.current || kioskFastPathSubmitTriggeredRef.current) return
    if (activeStepKey !== "payments") return
    if (showKioskPaymentTransition) return
    if (processing || identityCheckBusy || requiresSignIn) return
    if (kioskQrCheckout.phase !== "idle") return

    kioskFastPathSubmitTriggeredRef.current = true
    void handleSubmitRef.current()
  }, [
    activeStepKey,
    identityCheckBusy,
    isKioskTerminalFlow,
    kioskCardFastPathEligible,
    kioskQrCheckout.phase,
    open,
    processing,
    requiresSignIn,
    showKioskPaymentTransition,
  ])

  React.useEffect(() => {
    if (!open || !isKioskTerminalFlow || !kioskQrCheckout.sessionId || !kioskQrCheckoutPending) {
      return
    }

    let cancelled = false
    let timeoutId: number | null = null

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/checkout/session/status?sessionId=${encodeURIComponent(kioskQrCheckout.sessionId || "")}`,
          {
            credentials: "include",
          }
        )
        const data = await res.json().catch(() => null)
        if (cancelled) return

        const nextPhase = resolveKioskQrPhaseFromStatus(typeof data?.status === "string" ? data.status : null)

        if (nextPhase === "complete") {
          const completionMessage = await completeDropInCheckInAfterCardPayment({
            purchaseId: typeof data?.purchaseId === "string" ? data.purchaseId : null,
          })
          setSuccessMessage(
            completionMessage ||
              (typeof data?.paymentStatus === "string" && data.paymentStatus.trim().length > 0
                ? `Payment recorded successfully (${data.paymentStatus}).`
                : "Payment recorded successfully.")
          )
          setSuccess(true)
          setRequiresSignIn(false)
          setExistingAccountDetected(false)
          setResumeAfterSignInStep(null)
          setPendingAutoPay(false)
          setKioskQrCheckout(createEmptyKioskQrCheckoutState())
          return
        }

        if (nextPhase === "expired") {
          setKioskQrCheckout((prev) => ({
            ...prev,
            phase: "expired",
            awaitingWebhook: false,
            error:
              typeof data?.error === "string" && data.error.trim().length > 0
                ? data.error
                : "The hosted checkout session expired before payment completed.",
          }))
          return
        }

        if (!res.ok) {
          setKioskQrCheckout((prev) => ({
            ...prev,
            phase: "error",
            awaitingWebhook: false,
            error:
              typeof data?.error === "string" && data.error.trim().length > 0
                ? data.error
                : "Unable to refresh checkout status.",
          }))
          return
        }

        setKioskQrCheckout((prev) => ({
          ...prev,
          phase: nextPhase,
          awaitingWebhook: Boolean(data?.awaitingWebhook),
          purchaseId: typeof data?.purchaseId === "string" ? data.purchaseId : null,
          paymentStatus: typeof data?.paymentStatus === "string" ? data.paymentStatus : null,
          error: null,
        }))
      } catch (error) {
        if (cancelled) return
        console.warn("Unable to poll hosted checkout session status", error)
        setKioskQrCheckout((prev) => ({
          ...prev,
          phase: "error",
          awaitingWebhook: false,
          error: "Unable to refresh checkout status.",
        }))
        return
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, KIOSK_QR_POLL_INTERVAL_MS)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [completeDropInCheckInAfterCardPayment, isKioskTerminalFlow, kioskQrCheckout.sessionId, kioskQrCheckoutPending, open])

  const stepValid = (s: number) => {
    const stepKey = steps[s]?.key
    switch (stepKey) {
      case "party":
        // Paquete ahora es opcional según pedido; solo servicio y participantes
        return participants >= 1 && availableServices.some((opt) => opt.id === service)
      case "datetime":
        return Boolean(date) && Boolean(time)
      case "info":
        return contact.firstName.trim().length > 1 && contact.email.trim().length > 5 && isCompleteUSPhone(contact.phone)
      case "photo":
        return !requiresPhotoStep || photoSaved
      case "payments":
        return paymentMethod !== ""
      case "review":
        return true
      default:
        return false
    }
  }

  const canContinue = stepValid(step)
  const renderKioskCursorHint = (field: KioskNumericField) =>
    isKioskTerminalFlow && activeNumericField === field ? (
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-[2px] -translate-y-1/2 animate-pulse rounded-full bg-white"
      />
    ) : null
  const showAccountExistsSignInCopy = pendingAutoPay || existingAccountDetected
  const signInModalTitle =
    signInPurpose === "sms_verification"
      ? "Verify your phone to keep the new-student price"
      : signInPurpose === "account_preparation"
        ? "Sign in to continue"
        : showAccountExistsSignInCopy
          ? t("account_exists_title")
          : t("sign_in_modal_title")
  const signInModalSubtitle =
    signInPurpose === "sms_verification"
      ? "Complete SMS verification now. If you skip it, the booking will continue with the regular price."
      : signInPurpose === "account_preparation"
        ? "Sign in with your phone to upload your profile photo before payment."
        : showAccountExistsSignInCopy
          ? t("existing_customer_signin_required")
          : t("sign_in_modal_subtitle")

  const handleSignInDismiss = React.useCallback(() => {
    setRequiresSignIn(false)
    setExistingAccountDetected(false)
    setResumeAfterSignInStep(null)
    setPendingAutoPay(false)
    setResumeContactFlowAfterSignIn(false)
    setSignInPurpose("existing")

    if (signInPurpose === "sms_verification") {
      showRegularFallbackPopup(
        `Phone verification was not completed. We switched this booking to the regular $${regularServicePrice.toFixed(0)} price.`
      )
    }
  }, [regularServicePrice, showRegularFallbackPopup, signInPurpose])

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
              "mx-0 sm:mx-4 sm:max-w-5xl lg:max-w-6xl h-full sm:max-h-[92vh] rounded-none sm:rounded-2xl",
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
            className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 sm:right-3 sm:top-3"
            aria-label={t("aria_close")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
          </button>
        )}

        <div className={isInline ? "grid grid-cols-1 md:grid-cols-1" : "grid grid-cols-1 md:grid-cols-12"}>
          {/* Sidebar: stepper (form) OR calendar panel (success) */}
          {!hideCalendarSidebar && (
            <aside
              className={[
                "bg-neutral-900/90 text-white p-3 sm:p-4 space-y-3 sm:space-y-4",
                isInline ? "md:col-span-1" : "md:col-span-5",
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
                {activeStepKey !== "payments" && (
                  <>
                    <div className="mt-4 rounded-md border border-white/10 p-3 text-xs hidden sm:block">
                      <div className="font-semibold mb-2">{t("summary")}</div>
                        <div className={summaryGridClass}>
                          <div className="space-y-2">
                          {isKioskTerminalFlow && renderSummaryItem("Course", course.title)}
                          {renderSummaryItem(t("service"), course.enrollment.services.find((s)=>s.id===service)?.label || "—")}
                          {renderSummaryItem(t("package"), course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—")}
                          {!!addons.length && (
                            renderSummaryItem(
                              t("extras"),
                              addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")
                            )
                          )}
                          {renderSummaryItem(t("people"), participants)}
                        </div>
                        <div className="space-y-2">
                          {renderSummaryItem(isKioskTerminalFlow ? "Date/Time" : t("dateTime"), summaryDateTimeValue)}
                          {renderSummaryItem(t("email"), contact.email || "—")}
                          {renderSummaryItem(
                            t("total"),
                            <><span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 sm:hidden">
                      <details className="rounded-md border border-white/10 p-3 text-xs">
                        <summary className="cursor-pointer font-semibold list-none">{t("summary")}</summary>
                        <div className="mt-2 space-y-2">
                          {isKioskTerminalFlow && renderSummaryItem("Course", course.title)}
                          {renderSummaryItem(t("service"), course.enrollment.services.find((s)=>s.id===service)?.label || "—")}
                          {renderSummaryItem(t("package"), course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—")}
                          {!!addons.length && (
                            renderSummaryItem(
                              t("extras"),
                              addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")
                            )
                          )}
                          {renderSummaryItem(t("people"), participants)}
                          {renderSummaryItem(isKioskTerminalFlow ? "Date/Time" : t("dateTime"), summaryDateTimeValue)}
                          {renderSummaryItem(t("email"), contact.email || "—")}
                          {renderSummaryItem(
                            t("total"),
                            <><span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></>
                          )}
                        </div>
                      </details>
                    </div>
                  </>
                )}

                {/* Sin bloque de contacto; el chat vive en el UI global */}
                </>
              )}
            </aside>
          )}

          {/* Main content */}
          <section
            className={
              isInline
                ? "relative p-4 sm:p-6"
                : hideCalendarSidebar
                  ? "relative md:col-span-12 p-3 sm:p-6"
                  : "relative md:col-span-7 p-3 sm:p-6"
            }
          >
            <div className={isInline ? "" : "mx-auto w-full max-w-2xl"}>
              {!(success && isCheckInFlow) && (
                <div className="mb-3 flex items-center gap-2 pr-12">
                  {step > 0 && (
                    <button
                      type="button"
                      aria-label={t("back")}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10"
                    >
                      ←
                    </button>
                  )}
                  <h3 className={`${isInline ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-semibold leading-tight`}>
                    {steps[step]?.label} • {course.title}
                  </h3>
                </div>
              )}

            {success ? (
              <div className="mt-2">
                {/* Success header */}
                <div className="flex flex-col items-center py-4">
                  <div className="mb-2" aria-hidden>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">🎉</span>
                  </div>
                  <h3 className="text-xl font-semibold">{t("congratulations")}</h3>
                  <p className="text-xs text-neutral-500">{t("appointmentId")} {Math.abs((date+time).split("").reduce((a,c)=>a+c.charCodeAt(0),0)%1000) || 56}</p>
                  {successMessage && (
                    <p className="mt-3 max-w-md text-center text-sm text-neutral-600 dark:text-neutral-300">
                      {successMessage}
                    </p>
                  )}
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
                    <div className="text-right">${total.toFixed(2)} — {paymentMethodLabel}</div>
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
                <div className={`mt-6 border-t border-black/10 dark:border-white/10 px-3 py-3 flex items-center ${(allowPanelAccess || isPersonalCompletion) ? "justify-between" : "justify-end"}`}>
                  {allowPanelAccess && (
                    <Link href="/client-profile" className="text-sm font-medium">{t("customerPanel")}</Link>
                  )}
                  {isPersonalCompletion && (
                    <button
                      type="button"
                      onClick={() => router.push("/client-profile")}
                      className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10"
                    >
                      Go to my account
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isStationCompletion && onCompletedAction) {
                        if (stationCompletionTimeoutRef.current !== null) {
                          window.clearTimeout(stationCompletionTimeoutRef.current)
                          stationCompletionTimeoutRef.current = null
                        }
                        void onCompletedAction()
                        return
                      }
                      handleClose()
                    }}
                    className="px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white"
                  >
                    {isStationCompletion ? t("finish") : isPersonalCompletion ? "Close" : t("finish")}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  await handleFormStepSubmit()
                }}
                className="space-y-4"
              >
                {/* Step contents */}
                {activeStepKey === "party" && (
                  <div className="space-y-5">
                    <div className={`grid gap-3 ${isInline ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                      <fieldset className="space-y-2">
                        <label className="text-sm font-medium">{t("label_service")}</label>
                        <select
                          id="booking-service"
                          name="booking-service"
                          value={service}
                          onChange={(e) => {
                            if (isCheckInNewFlow && hasNewStudentService) return
                            setService(e.target.value)
                          }}
                          disabled={isCheckInNewFlow && hasNewStudentService}
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 disabled:opacity-70"
                        >
                          {availableServices.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}{s.price ? ` — $${s.price}` : ""}</option>
                          ))}
                        </select>
                        {isCheckInNewFlow && hasNewStudentService && (
                          <p className="text-xs text-neutral-500">Service preselected for new students.</p>
                        )}
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
                        <div className={`mt-3 grid gap-2 ${isInline ? "grid-cols-2 auto-rows-fr" : "grid-cols-1 sm:grid-cols-2"}`}>
                          {course.enrollment.packages.map((p) => {
                            const selected = pkg === p.id
                            const metaLine = formatPackageMeta(p)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setPkg(p.id)}
                                className={`h-full rounded-md border px-3 py-3 text-left transition ${
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
                        <div className="grid grid-cols-1 gap-2">
                          {course.enrollment.addons!.map((a) => (
                            <label
                              key={a.id}
                              className="flex w-full items-center justify-between gap-3 rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm"
                            >
                              <span>{a.label}{a.price ? ` — $${a.price}` : ""}</span>
                              <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggleAddon(a.id)} className="h-4 w-4 shrink-0" />
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </div>
                )}

                {activeStepKey === "datetime" && (
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
                            if (isCheckInFlow) return
                            setDate(d)
                            if (!d) {
                              setTime("")
                              setTimeLoading(false)
                              setCheckInScheduleNotice(null)
                              return
                            }
                            const nextSlots = getCurrentCourseTimesForDate(d)
                            setTime(nextSlots[0] || "")
                            setCheckInScheduleNotice(null)
                            setTimeLoading(true)
                            window.setTimeout(() => setTimeLoading(false), 350)
                          }}
                          compact={isInline}
                          className="w-full"
                          timezone={isCheckInFlow ? CHECKIN_TIME_ZONE : undefined}
                          availableWeekdays={courseAvailableWeekdays}
                          allowClear={!isCheckInFlow}
                          locked={isCheckInFlow}
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
                              {visibleTimeSlots.map((tSlot) => {
                                const slotExpired = isSlotExpiredForCheckIn(tSlot)
                                const isLocked = isCheckInFlow
                                return (
                                  <button
                                    type="button"
                                    key={tSlot}
                                    onClick={() => {
                                      if (isLocked) return
                                      setTime(tSlot)
                                    }}
                                    disabled={slotExpired}
                                    className={`px-3 py-1.5 rounded-md border text-sm ${
                                      time === tSlot
                                        ? "bg-[var(--brand,#111)] text-white border-transparent"
                                        : "border-black/10 dark:border-white/10"
                                    } ${
                                      slotExpired
                                        ? "opacity-40 cursor-not-allowed"
                                        : isLocked
                                          ? "cursor-default"
                                          : ""
                                    }`}
                                  >
                                    {to12h(tSlot)}
                                  </button>
                                )
                              })}
                              {visibleTimeSlots.length === 0 && (
                                <p className="text-xs text-muted-foreground">No time slots available for this day.</p>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">Select a date to view available times.</p>
                          <div className="h-3 w-32 rounded-full shimmer" />
                          <div className="h-3 w-24 rounded-full shimmer" />
                        </div>
                      )}
                      {isCheckInFlow && checkInScheduleNotice && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          {checkInScheduleNotice}
                        </div>
                      )}
                    </fieldset>
                  </div>
                )}

                {activeStepKey === "info" && (
                  shouldMaskKioskInfoContent ? (
                     <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center">
                       <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--brand,#ff7a7a)]" aria-hidden />
                       <h4 className="mt-4 text-lg font-semibold text-white">Getting payment ready</h4>
                       <p className="mt-2 text-sm leading-relaxed text-white/68">
                         We are using the saved student details and moving straight to payment.
                       </p>
                     </div>
                   ) : (
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
                    {!isCheckInFlow && (
                      <p className="text-xs text-neutral-500">
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                          setRequiresSignIn(true)
                          setExistingAccountDetected(false)
                          setResumeAfterSignInStep(null)
                          setPendingAutoPay(false)
                        }}
                          className="underline font-medium"
                        >
                          Sign in
                        </button>{" "}
                        and your details will be filled in automatically.
                      </p>
                    )}
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Phone</label>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-2 text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                        US
                      </span>
                      <div className="relative w-full">
                        <input
                          type={PHONE_INPUT_ATTRIBUTES.type}
                          value={contact.phone}
                          onChange={(e) => {
                            setPhoneTouched(true)
                            setContact((c) => ({ ...c, phone: formatUSPhone(e.target.value) }))
                          }}
                          onBlur={() => setPhoneTouched(true)}
                        onFocus={() => {
                          if (isKioskTerminalFlow) setActiveNumericField(selectKioskNumericField("phone"))
                        }}
                        onClick={() => {
                          if (isKioskTerminalFlow) setActiveNumericField(selectKioskNumericField("phone"))
                        }}
                          placeholder="(929) 387-6584"
                          readOnly={isKioskTerminalFlow}
                          inputMode={PHONE_INPUT_ATTRIBUTES.inputMode}
                          autoComplete={PHONE_INPUT_ATTRIBUTES.autoComplete}
                          enterKeyHint={PHONE_INPUT_ATTRIBUTES.enterKeyHint}
                          aria-invalid={phoneTouched && !isCompleteUSPhone(contact.phone)}
                          className={`w-full rounded-md border bg-white/80 px-3 py-2 dark:bg-white/10 ${
                            isKioskTerminalFlow && activeNumericField === "phone"
                              ? "border-sky-400/70 ring-2 ring-sky-300/20"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        />
                        {renderKioskCursorHint("phone")}
                      </div>
                    </div>
                    {isKioskTerminalFlow && (
                      <div className="mx-auto w-full max-w-[260px]">
                        <KioskNumericKeypad
                          size="compact"
                          className="border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]"
                          onDigit={(digit) => {
                            setActiveNumericField(selectKioskNumericField("phone"))
                            setPhoneTouched(true)
                            setContact((c) => ({ ...c, phone: appendPhoneDigit(c.phone, digit) }))
                          }}
                          onBackspace={() => {
                            setActiveNumericField(selectKioskNumericField("phone"))
                            setPhoneTouched(true)
                            setContact((c) => ({ ...c, phone: removePhoneDigit(c.phone) }))
                          }}
                          onClear={() => {
                            setActiveNumericField(selectKioskNumericField("phone"))
                            setPhoneTouched(true)
                            setContact((c) => ({ ...c, phone: clearPhoneDigits() }))
                          }}
                        />
                      </div>
                    )}
                    {phoneTouched && !isCompleteUSPhone(contact.phone) && (
                      <p className="text-xs text-red-600">{t("phone_format_hint")}</p>
                    )}
                  </fieldset>
                  {!isKioskTerminalFlow && (
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">{t("label_notes")}</label>
                    <textarea value={contact.note} onChange={(e)=>setContact((c)=>({...c, note: e.target.value}))} rows={3} placeholder={t("placeholder_notes")} className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2" />
                  </fieldset>
                  )}
                </div>
                  )
                )}

                {activeStepKey === "photo" && (
                  <div className="space-y-4">
                    <ProfilePhotoCapture
                      policy={photoPolicy}
                      targetUserId={preparedAccount?.clerkUserId}
                      onSaved={() => {
                        setPhotoSaved(true)
                        setPreparedAccount((prev) =>
                          prev
                            ? {
                                ...prev,
                                hasAvatar: true,
                              }
                            : prev
                        )
                        setFormError(null)
                      }}
                    />
                  </div>
                )}

                {activeStepKey === "payments" && (
                  <div className="space-y-4">
                    {/* Payments step */}
                    <div>
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-2.5">
                        {isCheckInFlow && (
                          <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 p-3">
                            <div className="text-sm font-semibold">{t("reviewAndConfirm")}</div>
                            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-white/70 sm:grid-cols-2">
                              <div>{t("course")}: <span className="text-neutral-900 dark:text-white">{course.title}</span></div>
                              <div>{t("service")}: <span className="text-neutral-900 dark:text-white">{course.enrollment.services.find((s)=>s.id===service)?.label}{pkgOpt ? " (included in package)" : ""}</span></div>
                              <div>{t("dateTime")}: <span className="text-neutral-900 dark:text-white">{date} {to12h(time)}</span></div>
                              <div>{t("people")}: <span className="text-neutral-900 dark:text-white">{participants}</span></div>
                              <div>{t("name")}: <span className="text-neutral-900 dark:text-white">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</span></div>
                              <div>{t("email")}: <span className="text-neutral-900 dark:text-white">{contact.email || "—"}</span></div>
                              <div>Phone: <span className="text-neutral-900 dark:text-white">{contact.phone || "—"}</span></div>
                              {!!addons.length && (
                                <div>{t("extras")}: <span className="text-neutral-900 dark:text-white">{addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</span></div>
                              )}
                              {pkg && (
                                <div>{t("package")}: <span className="text-neutral-900 dark:text-white">{course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</span></div>
                              )}
                              {contact.note && <div className="sm:col-span-2">{t("notes")}: <span className="text-neutral-900 dark:text-white">{contact.note}</span></div>}
                            </div>
                          </div>
                        )}

                        <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/70 p-2.5 dark:bg-white/10">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{t("payments_classes")}</div>
                          <div className="mt-1 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium leading-snug">
                                {course.title} — {course.enrollment.services.find((s)=>s.id===service)?.label}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-white/60">
                                <span>{participants} {participants===1?t("onePerson"):t("manyPeople")}</span>
                                <span>Service: {serviceOpt?.label || "—"}{pkgOpt ? " (included)" : ""}</span>
                                {pkgOpt && <span>Package: {pkgOpt.label}</span>}
                                {!!addonsOpts.length && <span>Extras: {addonsOpts.map((a)=>a.label).join(", ")}</span>}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-semibold">${subtotal.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium" htmlFor="coupon">{t("payments_coupon")}</label>
                          <input
                            id="coupon"
                            value={couponInput}
                            onChange={(e)=>setCouponInput(e.target.value)}
                            placeholder={t("payments_coupon_placeholder")}
                            disabled={kioskQrCheckoutLocked}
                            className="flex-1 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                          />
                          {appliedCoupon ? (
                            <button
                              type="button"
                              disabled={kioskQrCheckoutLocked}
                              onClick={()=>{ setAppliedCoupon(null); setCouponInput("") }}
                              className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                            >
                              {t("payments_remove")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={kioskQrCheckoutLocked}
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
                          disabled={kioskQrCheckoutLocked}
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
                          disabled={kioskQrCheckoutLocked}
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

                    {service === "new-student" && (
                      <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 p-3 space-y-3">
                        <div>
                          <div className="text-sm font-semibold">Create student PIN</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-white/60">
                            This 4-digit PIN is required for future kiosk check-ins and account recovery.
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <input
                            inputMode="numeric"
                            maxLength={4}
                            type="password"
                            value={studentPin}
                            onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                            placeholder="4-digit PIN"
                          />
                          <input
                            inputMode="numeric"
                            maxLength={4}
                            type="password"
                            value={studentPinConfirm}
                            onChange={(e) => setStudentPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                            placeholder="Confirm PIN"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isCheckInFlow && activeStepKey === "review" && (
                  <div className="space-y-4">
                    <GlassyCard className="p-4">
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{t("reviewAndConfirm")}</div>
                        <div>{t("course")}: {course.title}</div>
                        <div>{t("service")}: {course.enrollment.services.find((s)=>s.id===service)?.label}{pkgOpt ? " (included in package)" : ""}</div>
                        <div>{t("package")}: {course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</div>
                        {!!addons.length && <div>{t("extras")}: {addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</div>}
                        <div>{t("people")}: {participants}</div>
                        <div>{t("dateTime")}: {date} {to12h(time)}</div>
                        <div>{t("name")}: {`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
                        <div>{t("email")}: {contact.email || "—"}</div>
                        <div>Phone: {contact.phone || "—"}</div>
                        {service === "new-student" && <div>Student PIN: {studentPin ? "Configured" : "Required"}</div>}
                        <div>{t("paymentMethod")}: {paymentMethodLabel}</div>
                        {contact.note && <div>{t("notes")}: {contact.note}</div>}
                        <div className="pt-2">{t("estimatedTotal")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
                      </div>
                    </GlassyCard>
                    {service === "new-student" && (
                      <GlassyCard className="p-4">
                        <div className="text-sm font-medium">Create student PIN</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-white/60">
                          New students must finish signup with a personal 4-digit PIN.
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <input
                            inputMode="numeric"
                            maxLength={4}
                            type="password"
                            value={studentPin}
                            onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                            placeholder="4-digit PIN"
                          />
                          <input
                            inputMode="numeric"
                            maxLength={4}
                            type="password"
                            value={studentPinConfirm}
                            onChange={(e) => setStudentPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                            placeholder="Confirm PIN"
                          />
                        </div>
                      </GlassyCard>
                    )}
                  </div>
                )}

                {/* Footer actions */}
                <div className={isInline ? "flex flex-col gap-2 pt-2" : "flex items-center justify-between pt-2"}>
                  <button
                    type="button"
                    onClick={handleClose}
                    className={isInline ? "w-full px-4 py-2 rounded-md border border-black/10 dark:border-white/10" : "px-4 py-2 rounded-md border border-black/10 dark:border-white/10"}
                  >
                    {t("cancel")}
                  </button>
                  <div className={isInline ? `grid w-full ${allowPanelAccess ? "grid-cols-3" : "grid-cols-2"} gap-2` : "flex gap-2"}>
                    {allowPanelAccess && (
                      <Link href="/client-profile" className="px-4 py-2 rounded-md border border-black/10 dark:border-white/10 hidden sm:inline">{t("myPanel")}</Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (kioskQrCheckoutLocked) {
                          resetKioskQrCheckout()
                          return
                        }
                        setStep((s) => Math.max(0, s - 1))
                      }}
                      disabled={step === 0 && !kioskQrCheckoutLocked}
                      className={isInline ? "px-3 py-2 rounded-md border border-black/10 dark:border-white/10 disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md border border-black/10 dark:border-white/10 disabled:opacity-50"}
                    >
                      {kioskQrCheckoutLocked ? "Cancel QR" : t("back")}
                    </button>
                    {step < steps.length - 1 ? (
                      <button
                        type="submit"
                        disabled={!canContinue || identityCheckBusy}
                        className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
                      >
                        {identityCheckBusy ? t("verifyingAccount") : t("continue")}
                      </button>
                    ) : (
                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          disabled={processing || identityCheckBusy || kioskQrCheckoutLocked}
                          className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
                        >
                          {processing
                            ? "Processing..."
                            : isKioskTerminalFlow && paymentMethod === "stripe"
                              ? kioskQrCheckout.phase === "expired" || kioskQrCheckout.phase === "error"
                                ? "Create new QR"
                                : "Show QR"
                              : t("confirm")}
                        </button>
                    )}
                  </div>
                </div>
                {formError && <p className="text-sm text-red-600 mt-2" role="alert" aria-live="polite">{formError}</p>}
              </form>
            )}
            {showKioskPaymentTransition && !success && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(24,12,12,0.72)] px-6 py-8 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[rgba(28,18,18,0.92)] px-6 py-8 text-center text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-white" aria-hidden />
                  <h4 className="mt-4 text-xl font-semibold leading-tight">{kioskPaymentTransitionMessage}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/72">One moment while we prepare the payment step.</p>
                </div>
              </div>
            )}
            </div>
          </section>
        </div>
        {showStripeModal && stripeClientSecret && (
          <StripePaymentModal
            clientSecret={stripeClientSecret}
            onClose={() => setShowStripeModal(false)}
            onSuccess={async (paymentIntentId?: string) => {
              let completionMessage: string | null = null
              let purchaseFinalized = false

              if (paymentIntentId) {
                try {
                  const token = isSignedIn ? await getToken({ skipCache: true }) : null
                  const finalizeRes = await fetch("/api/checkout/finalize", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: "include",
                    body: JSON.stringify({ paymentIntentId }),
                  })
                  purchaseFinalized = finalizeRes.ok

                  if (finalizeRes.ok) {
                    completionMessage = await completeDropInCheckInAfterCardPayment({ paymentIntentId })
                  }
                } catch (error) {
                  console.warn("Unable to finalize purchase sync", error)
                  completionMessage = isCheckInFlow
                    ? "Payment was completed, but we couldn't confirm automatic check-in."
                    : null
                }
              }
              if (isCheckInFlow && !completionMessage) {
                completionMessage = purchaseFinalized
                  ? "Purchase recorded successfully."
                  : "Payment was completed, but check-in sync is still pending."
              }
              setSuccessMessage(completionMessage)
              setSuccess(true)
            }}
            email={contact.email}
            name={`${contact.firstName} ${contact.lastName}`.trim()}
            phone={contact.phone}
          />
        )}
        {isKioskTerminalFlow && paymentMethod === "stripe" && kioskQrCheckout.phase !== "idle" && (
          <KioskQrPaymentPanel
            checkoutState={kioskQrCheckout}
            onCancel={resetKioskQrCheckout}
            onRetry={() => {
              kioskFastPathSubmitTriggeredRef.current = true
              setFormError(null)
              void handleSubmit()
            }}
          />
        )}
      </GlassyCard>
      {flowPopup && (
        <div className="fixed inset-0 z-[10015] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--brand,#c71818)]">Booking update</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{flowPopup.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{flowPopup.message}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFlowPopup(null)
                  void advanceFromContactStepRef.current()
                }}
                className="rounded-md bg-[var(--brand,#111)] px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      {requiresSignIn && (
        <div
          className={`fixed inset-0 z-[10020] flex ${
            signInModalVariant === "compact"
              ? "items-center justify-center px-4 py-4"
              : "items-stretch justify-end px-2 py-6 sm:px-4"
          }`}
        >
          <button
            type="button"
            aria-label={t("aria_close")}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleSignInDismiss}
          />
          <div
            className={`relative z-10 w-full rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] ${
              signInModalVariant === "compact" ? "max-w-sm" : "sm:max-w-md"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="pr-10">
                <h3 className="text-lg font-semibold text-white">{signInModalTitle}</h3>
                <p className="text-sm text-white/68">{signInModalSubtitle}</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04]"
                onClick={handleSignInDismiss}
              >
                {t("cancel")}
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <EmbeddedSignIn
                redirectUrl={signInReturnTo}
                phoneNumber={toE164Phone(contact.phone)}
                useNumericKeypad={isKioskTerminalFlow}
                onSuccessAction={
                  isCheckInFlow
                    ? async () => {
                        setFormError(null)
                      }
                    : undefined
                }
              />
            </div>
            {signInModalVariant === "sheet" && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-white/72 underline decoration-white/25 underline-offset-4"
                  onClick={handleSignInDismiss}
                >
                  {t("account_exists_back")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
