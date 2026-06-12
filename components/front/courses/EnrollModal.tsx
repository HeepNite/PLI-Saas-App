"use client"
import React from "react"
import Link from "next/link"
import CalendarPicker from "../ui/CalendarPicker"
import { demoCourses, type EnrollmentOption } from "@/constants/courses"
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
import {
  computeCheckInAutofill as computeCheckInAutofillModel,
  formatCheckInSummaryDateTime as formatCheckInSummaryDateTimeModel,
} from "@/components/front/courses/enroll/model/checkin-autofill"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { useNewStudentVerification } from "./hooks/useNewStudentVerification"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"
import ProfilePhotoCapture from "@/components/front/checkin/ProfilePhotoCapture"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import {
  getPhotoPolicy,
  isPhotoRequiredForAccount,
  type PhotoFlowContext,
} from "@/lib/checkin/photo-context-policy"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import {
  createKioskSessionCheckoutPayloadFields,
  getCheckInSignInModalVariant,
  handleEmbeddedSignInSessionCreated,
  handleExistingUserDetected,
  isCheckInContactGateStep,
  resolveStationTimeoutAction,
  resolveEnrollInitialStep,
  resolveEnrollStepKeys,
  notifyPaymentsStepReadyForOpenSession,
  shouldIncludePhotoStep,
} from "@/lib/checkin/enroll-flow"
import {
  createEmptyKioskQrCheckoutState,
  getKioskPaymentTransitionRemainingMs,
  getKioskPaymentTransitionMessage,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  isKioskQrPendingPhase,
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
import { createInitialEnrollFlowState, enrollFlowReducer } from "@/components/front/courses/enroll/model/enroll-flow.reducer"
import { resolveFlowStepKeys } from "@/components/front/courses/enroll/model/enroll-selectors"
import type { EnrollFlowState } from "@/components/front/courses/enroll/model/enroll-flow.types"
import { buildEnrollCalendarLinks } from "@/components/front/courses/enroll/model/enroll-calendar"
import { buildEnrollCheckoutPayload } from "@/components/front/courses/enroll/model/checkout-payload"
import { calculateEnrollPricing } from "@/components/front/courses/enroll/model/enroll-pricing"
import { resolveAvailableEnrollServices } from "@/components/front/courses/enroll/model/enroll-services"
import { validateEnrollBeforeSubmit } from "@/components/front/courses/enroll/model/enroll-validation"
import EnrollInfoStep from "@/components/front/courses/enroll/steps/EnrollInfoStep"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import { appendPhoneDigit, removePhoneDigit } from "@/lib/checkin/numeric-keypad"
import {
  requestCheckoutCashApi,
  requestCheckoutFinalizeApi,
  requestCheckoutIntentApi,
  requestCheckoutSessionApi,
  requestDropInCheckInApi,
  requestNewStudentOutcomeApi,
  requestPinAvailabilityApi,
} from "@/components/front/courses/enroll/effects/checkout-api"
import { createKioskQrPoller } from "@/components/front/courses/enroll/effects/kiosk-qr-poller"

// EnrollModal: popup demo to select service, package, add-ons, date, time, and basic contact data.
// - This is a client-only component. It does not call a backend; it shows a local success state.
//   Replace the `handleSubmit` implementation with a real API
//   call when you are ready.
// - All inputs are controlled in the local state for simplicity.

type EnrollFlowVariant = "default" | "checkin-new" | "checkin-existing"
type EnrollCompletionMode = "default" | "personal" | "station"
type CompactBookingSource = "qr-mobile"

const CHECKIN_TIME_ZONE = "America/New_York"
const CHECKIN_LATE_GRACE_MINUTES = 20
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/

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

export const formatCheckInSummaryDateTime = formatCheckInSummaryDateTimeModel
export const computeCheckInAutofill = computeCheckInAutofillModel

const sortTime24 = (values: string[]) =>
  [...new Set(values.filter((value) => TIME_24_REGEX.test(value)))].sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))

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
  onExistingUserDetected,
  onKioskSessionCreated,
  initialStep,
  mode = "modal",
  prefillContact,
  prefillHasAvatar,
  prefillSelection,
  flowVariant = "default",
  compactBookingSource,
  completionMode = "default",
  photoFlowContext = "external_web",
  checkInContext,
  kioskSessionToken,
  useDraft = true,
  preventOutsideClose = false,
  skipContactStep = false,
  consecutiveOffer,
  isPackageHolder = false,
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
  onExistingUserDetected?: () => void
  onKioskSessionCreated?: (sessionId: string) => void
  initialStep?: number
  mode?: "modal" | "inline"
  prefillContact?: Partial<EnrollmentContact>
  prefillHasAvatar?: boolean
  prefillSelection?: EnrollPrefillSelection
  flowVariant?: EnrollFlowVariant
  compactBookingSource?: CompactBookingSource
  completionMode?: EnrollCompletionMode
  photoFlowContext?: PhotoFlowContext
  checkInContext?: EnrollCheckInContext
  kioskSessionToken?: string
  useDraft?: boolean
  preventOutsideClose?: boolean
  /** Trusted account flows can skip the contact / "Your Information" step. */
  skipContactStep?: boolean
  /** Consecutive class offer data — when present, inserts a "consecutive" step between packages and payments */
  consecutiveOffer?: ConsecutiveOfferData
  /** Whether the student has an active package (affects consecutive pricing) */
  isPackageHolder?: boolean
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
  const verification = useNewStudentVerification()
  const verificationState = verification.state
  const verifyNewStudent = verification.verify
  const resetVerification = verification.reset
  const markSmsVerified = verification.onSmsVerified
  const isInline = mode === "inline"
  const checkInContextDate = normalizeIsoDate(checkInContext?.date)
  const checkInContextTime = normalizeTime24(checkInContext?.time)
  const checkInContextDuration = normalizeDurationMinutes(checkInContext?.durationMinutes)
  const isCheckInNewFlow = flowVariant === "checkin-new"
  const isCheckInFlow = flowVariant === "checkin-new" || flowVariant === "checkin-existing"
  const isCheckInExistingFlow = flowVariant === "checkin-existing"
  const isQrMobileCompactFlow = compactBookingSource === "qr-mobile"
  const usesCompactCheckInExperience = isCheckInFlow || isQrMobileCompactFlow
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"
  const forceKioskDarkModal = isKioskTerminalFlow && !isInline
  const isStationCompletion = isCheckInFlow && completionMode === "station"
  const isPersonalCompletion = usesCompactCheckInExperience && completionMode === "personal"
  const photoPolicy = React.useMemo(() => getPhotoPolicy(photoFlowContext), [photoFlowContext])
  const allowPanelAccess = !isCheckInFlow
  const availableServices = React.useMemo(
    () =>
      resolveAvailableEnrollServices({
        services: course.enrollment.services,
        isCheckInExistingFlow,
        skipContactStep,
      }),
    [course.enrollment.services, isCheckInExistingFlow, skipContactStep]
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
  const initialContact = React.useMemo<EnrollmentContact>(
    () => ({
      firstName: "",
      lastName: "",
      email: "",
      phone: "+1 ",
      note: "",
    }),
    []
  )
  const [flowState, dispatchFlow] = React.useReducer(
    enrollFlowReducer,
    createInitialEnrollFlowState({
      contact: initialContact,
      maxStep: 0,
      service: availableServices[0]?.id ?? "",
    })
  )
  const service = flowState.service
  const pkg = flowState.pkg
  const addons = flowState.addons
  const participants = flowState.participants
  // Paso 1: fecha/hora
  const [date, setDate] = React.useState<string>("") // YYYY-MM-DD
  const [time, setTime] = React.useState<string>("") // HH:MM
  // Paso 3: pagos
  const [couponInput, setCouponInput] = React.useState<string>("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<Coupon>(null)
  const paymentMethod = flowState.paymentMethod
  const [studentPin, setStudentPin] = React.useState("")
  const [studentPinConfirm, setStudentPinConfirm] = React.useState("")
  const [pinAvailabilityError, setPinAvailabilityError] = React.useState<string | null>(null)
  const [checkingPinAvailability, setCheckingPinAvailability] = React.useState(false)
  const [activeNumericField, setActiveNumericField] = React.useState<"phone" | "pin" | "pin-confirm" | null>(null)
  // Paso 2: datos de contacto (modular, sin teléfono)
  const contact = flowState.contact
  // Flujo multi‑paso + éxito
  const step = flowState.step
  const success = flowState.success
  const successMessage = flowState.successMessage
  const processing = flowState.processing
  const [timeLoading, setTimeLoading] = React.useState<boolean>(false)
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true)
  const formError = flowState.formError
  const requiresSignIn = flowState.requiresSignIn
  const existingAccountDetected = flowState.existingAccountDetected
  const resumeAfterSignInStep = flowState.resumeAfterSignInStep
  const [pendingAutoPay, setPendingAutoPay] = React.useState<boolean>(false)
  const resumeContactFlowAfterSignIn = flowState.resumeContactFlowAfterSignIn
  const [identityCheckBusy, setIdentityCheckBusy] = React.useState<boolean>(false)
  const [phoneTouched, setPhoneTouched] = React.useState<boolean>(false)
  const [stripeClientSecret, setStripeClientSecret] = React.useState<string>("")
  const [showStripeModal, setShowStripeModal] = React.useState<boolean>(false)
  const kioskQrCheckout = flowState.kioskQrCheckout
  const [preparedAccount, setPreparedAccount] = React.useState<PreparedAccountState | null>(null)
  const [photoSaved, setPhotoSaved] = React.useState<boolean>(false)

  const [consecutiveAccepted, setConsecutiveAccepted] = React.useState(false)
  const [consecutiveAddedCents, setConsecutiveAddedCents] = React.useState(0)
  const [consecutiveChoiceMade, setConsecutiveChoiceMade] = React.useState(false)
  const [fetchedConsecutiveOffer, setFetchedConsecutiveOffer] = React.useState<ConsecutiveOfferData | null>(null)
  const [consecutiveOfferLoading, setConsecutiveOfferLoading] = React.useState(false)

  const [newStudentFallbackPhoneKey, setNewStudentFallbackPhoneKey] = React.useState<string | null>(null)
  const [flowPopup, setFlowPopup] = React.useState<FlowPopupState | null>(null)
  const signInPurpose = flowState.signInPurpose
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
  // A user who selects a package during the same flow counts as a package holder for consecutive pricing.
  const effectiveIsPackageHolder = isPackageHolder || Boolean(pkg)
  const effectiveConsecutiveOffer = consecutiveOffer ?? fetchedConsecutiveOffer
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
    () => {
      return resolveFlowStepKeys({
        isCheckInFlow,
        isQrMobileCompactFlow,
        isCheckInNewFlow,
        isKioskTerminalFlow,
        requiresPhotoStep,
        skipInfoStep: skipContactStep,
        hasPackages: course.enrollment.packages.length > 0,
        hasConsecutiveOffer: Boolean(effectiveConsecutiveOffer),
      })
    },
    [isCheckInFlow, isQrMobileCompactFlow, isCheckInNewFlow, isKioskTerminalFlow, requiresPhotoStep, skipContactStep, course.enrollment.packages.length, effectiveConsecutiveOffer]
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
                : key === "packages"
                  ? "Packages"
                  : key === "consecutive"
                    ? "Promo"
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
    packages: Building2,
    consecutive: CalendarCheck,
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
  const infoStepIndex = React.useMemo(
    () => steps.findIndex((item) => item.key === "info"),
    [steps]
  )
  const photoStepIndex = React.useMemo(
    () => steps.findIndex((item) => item.key === "photo"),
    [steps]
  )
  const packagesStepIndex = React.useMemo(
    () => steps.findIndex((item) => item.key === "packages"),
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

  const setService = React.useCallback((value: React.SetStateAction<string>) => {
    dispatchFlow({ type: "field/set-service", value })
  }, [])
  const setPkg = React.useCallback((value: React.SetStateAction<string>) => {
    dispatchFlow({ type: "field/set-package", value })
  }, [])
  const setAddons: React.Dispatch<React.SetStateAction<string[]>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-addons", value })
  }, [])
  const setParticipants = React.useCallback((value: React.SetStateAction<number>) => {
    dispatchFlow({ type: "field/set-participants", value })
  }, [])
  const setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-contact", value })
  }, [])
  const setPaymentMethod = React.useCallback((value: React.SetStateAction<PaymentMethod>) => {
    dispatchFlow({ type: "field/set-payment-method", value })
  }, [])
  const setStep = React.useCallback((value: React.SetStateAction<number>) => {
    dispatchFlow({ type: "field/set-step", value, maxStep: Math.max(0, steps.length - 1) })
  }, [steps.length])
  const setSuccess = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-success", value })
  }, [])
  const setSuccessMessage = React.useCallback((value: React.SetStateAction<string | null>) => {
    dispatchFlow({ type: "field/set-success-message", value })
  }, [])
  const setProcessing = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-processing", value })
  }, [])
  const setFormError = React.useCallback((value: React.SetStateAction<string | null>) => {
    dispatchFlow({ type: "field/set-form-error", value })
  }, [])
  const setRequiresSignIn = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-sign-in-required", value })
  }, [])
  const setExistingAccountDetected = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-existing-account-detected", value })
  }, [])
  const setResumeAfterSignInStep = React.useCallback((value: React.SetStateAction<number | null>) => {
    dispatchFlow({ type: "field/set-resume-after-sign-in-step", value })
  }, [])
  const setResumeContactFlowAfterSignIn = React.useCallback((value: React.SetStateAction<boolean>) => {
    dispatchFlow({ type: "field/set-resume-contact-flow", value })
  }, [])
  const setKioskQrCheckout: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>> = React.useCallback((value) => {
    dispatchFlow({ type: "field/set-kiosk-qr-checkout", value })
  }, [])
  const setSignInPurpose = React.useCallback((value: React.SetStateAction<EnrollFlowState["signInPurpose"]>) => {
    dispatchFlow({ type: "field/set-sign-in-purpose", value })
  }, [])

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
  }, [isCheckInNewFlow, open, prefillContact, setContact])

  React.useEffect(() => {
    const id = window.setTimeout(() => setInitialLoading(false), 400)
    return () => window.clearTimeout(id)
  }, [])

  React.useEffect(() => {
    if (consecutiveOffer) {
      setFetchedConsecutiveOffer(null)
      setConsecutiveOfferLoading(false)
      return
    }
    if (!isQrMobileCompactFlow && !isCheckInFlow) {
      setFetchedConsecutiveOffer(null)
      setConsecutiveOfferLoading(false)
      return
    }
    if (!date || !time) {
      setFetchedConsecutiveOffer(null)
      setConsecutiveOfferLoading(false)
      setConsecutiveAccepted(false)
      setConsecutiveAddedCents(0)
      setConsecutiveChoiceMade(false)
      return
    }

    setConsecutiveOfferLoading(true)
    const controller = new AbortController()
    const params = new URLSearchParams({ courseSlug: course.slug, date, time })
    void fetch(`/api/checkin/terminal/consecutive-offer?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((offer: ConsecutiveOfferData | null) => {
        setFetchedConsecutiveOffer(offer)
        setConsecutiveOfferLoading(false)
        setConsecutiveAccepted(false)
        setConsecutiveAddedCents(0)
        setConsecutiveChoiceMade(false)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setFetchedConsecutiveOffer(null)
        setConsecutiveOfferLoading(false)
        setConsecutiveAccepted(false)
        setConsecutiveAddedCents(0)
        setConsecutiveChoiceMade(false)
      })

    return () => controller.abort()
  }, [consecutiveOffer, course.slug, date, isCheckInFlow, isQrMobileCompactFlow, time])

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
    setPinAvailabilityError(null)
    setCheckingPinAvailability(false)
    setNewStudentFallbackPhoneKey(null)
    setFlowPopup(null)
    setSignInPurpose("existing")
    setFormError(null)
    setProcessing(false)
    setShowKioskPaymentTransition(false)
    setConsecutiveAccepted(false)
    setConsecutiveAddedCents(0)
    setConsecutiveChoiceMade(false)
    setFetchedConsecutiveOffer(null)
    setConsecutiveOfferLoading(false)
    kioskPaymentTransitionStartedAtRef.current = null
    kioskFastPathAdvanceTriggeredRef.current = false
    kioskFastPathSubmitTriggeredRef.current = false
  }, [
    setAddons,
    setContact,
    setExistingAccountDetected,
    setFormError,
    setKioskQrCheckout,
    setParticipants,
    setProcessing,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setSignInPurpose,
    setStep,
    setSuccess,
    setSuccessMessage,
  ])

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
      resetVerification()
    }
  }, [open, isInline, resetForm, resetVerification])

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

    const timeoutAction = resolveStationTimeoutAction(onTimeoutAction, onCompletedAction)
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
    setAddons,
    setPkg,
    setService,
  ])

  React.useEffect(() => {
    if (isNewStudent && participants !== 1) {
      setParticipants(1)
    }
  }, [isNewStudent, participants, setParticipants])

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
  }, [hasNewStudentService, isCheckInNewFlow, open, regularFallbackLocked, service, setService])

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
  }, [isCheckInNewFlow, isLoaded, isSignedIn, user, open, isInline, setContact])

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
    const shouldAutofillDateTime = isCheckInFlow || Boolean(checkInContextDate || checkInContextTime)
    const checkInAutofill = shouldAutofillDateTime
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
    setAddons,
    setContact,
    setExistingAccountDetected,
    setFormError,
    setKioskQrCheckout,
    setParticipants,
    setPaymentMethod,
    setPkg,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setService,
    setStep,
    sourceCourses,
  ])

  // No early returns before hooks complete. We will conditionally render at the final return

  const pricing = calculateEnrollPricing({
    services: availableServices,
    packages: course.enrollment.packages,
    addons: course.enrollment.addons,
    serviceId: service,
    packageId: pkg,
    addonIds: addons,
    participants,
    appliedCoupon,
    consecutiveAccepted,
    consecutiveAddedCents,
  })
  const serviceOpt = pricing.serviceOpt
  const pkgOpt = pricing.packageOpt
  const addonsOpts = pricing.addonOptions
  const subtotal = pricing.subtotal
  const discount = pricing.discount
  const total = pricing.total
  // Hide sidebar: on success for check-in flows, or during payments step for kiosk terminal
  const hideCalendarSidebar = Boolean(
    (success && isCheckInFlow) ||
    (isKioskTerminalFlow && steps[step]?.key === "payments")
  )
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
  const calendarLinks = React.useMemo(
    () =>
      buildEnrollCalendarLinks({
        course,
        serviceLabel: course.enrollment.services.find((s) => s.id === service)?.label || "",
        participants,
        total,
        date,
        time,
        classWord: t("classWord"),
        googleDetails: t("googleCal_details", { participants, total: total.toFixed(2) }),
        icsDescription: t("ics_description", { participants, total: total.toFixed(2) }),
      }),
    [course, date, participants, service, t, time, total]
  )
  const eventDates = calendarLinks.eventDates
  const googleCalHref = calendarLinks.googleCalHref
  const icsDataUri = calendarLinks.icsDataUri

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const validateBeforeSubmit = () => {
    return validateEnrollBeforeSubmit({
      services: availableServices,
      packages: course.enrollment.packages,
      addons: course.enrollment.addons,
      serviceId: service,
      packageId: pkg,
      addonIds: addons,
      participants,
      date,
      time,
      contact,
      skipContactValidation: skipContactStep,
      studentPin,
      studentPinConfirm,
      contactStepIndex: infoStepIndex,
      paymentMethod,
      paymentsStepIndex,
      total,
    })
  }

  const buildCheckoutPayload = React.useCallback(
    (extra: Record<string, unknown> = {}) =>
      buildEnrollCheckoutPayload({
        course,
        total,
        date,
        time,
        contact,
        participants,
        addonIds: addons,
        appliedCoupon,
        packageId: pkg,
        serviceId: service,
        photoFlowContext,
        kioskSessionFields: createKioskSessionCheckoutPayloadFields(kioskSessionToken),
        checkInContextDate,
        checkInContextTime,
        studentPin,
        studentPinConfirm,
        consecutiveAccepted,
        consecutiveAddedCents,
        consecutiveOffer: effectiveConsecutiveOffer ?? undefined,
        extra,
      }),
    [
      addons,
      appliedCoupon?.code,
      contact.email,
      contact.firstName,
      contact.lastName,
      contact.phone,
      consecutiveAccepted,
      consecutiveAddedCents,
      effectiveConsecutiveOffer,
      course.slug,
      course.title,
      date,
      participants,
      photoFlowContext,
      checkInContextDate,
      checkInContextTime,
      infoStepIndex,
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
    const { res, data } = await requestNewStudentOutcomeApi({ phone: contact.phone })

    if (!res.ok || !data || typeof data.outcome !== "string") {
      setFormError(
        typeof data?.error === "string" && data.error.trim().length > 0
          ? data.error
          : "We couldn't verify the customer's phone."
      )
      return null
    }

    return data as NewStudentVerifyResponse
  }, [contact.phone, setFormError])

  const requestAccountPreparation = React.useCallback(async () => {
    const { res, data } = await requestCheckoutIntentApi({
      payload: buildCheckoutPayload({ prepareOnly: true }),
    })
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
  }, [buildCheckoutPayload, setFormError])

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
    [contact.phone, regularServiceId, regularServicePrice, service, setService]
  )

  const checkPinAvailability = React.useCallback(async (pin: string): Promise<boolean> => {
    try {
      setCheckingPinAvailability(true)
      const { data } = await requestPinAvailabilityApi({ pin })
      if (!data.available) {
        setPinAvailabilityError(data.message || "This PIN is already in use. Please choose a different one.")
        setStudentPin("")
        setStudentPinConfirm("")
        if (isKioskTerminalFlow) setActiveNumericField("pin")
        return false
      }
      setPinAvailabilityError(null)
      return true
    } catch {
      // Network error — proceed anyway, don't block on availability check failure
      setPinAvailabilityError(null)
      return true
    } finally {
      setCheckingPinAvailability(false)
    }
  }, [isKioskTerminalFlow])

  const handleNumpadDigit = React.useCallback((digit: string) => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: appendPhoneDigit(c.phone, digit) }))
      setPhoneTouched(true)
    } else if (activeNumericField === "pin") {
      setStudentPin((prev) => {
        const next = (prev + digit).slice(0, 4)
        if (next.length === 4) setActiveNumericField("pin-confirm")
        return next
      })
      setPinAvailabilityError(null)
    } else if (activeNumericField === "pin-confirm") {
      setStudentPinConfirm((prev) => (prev + digit).slice(0, 4))
      setPinAvailabilityError(null)
    }
  }, [activeNumericField, setContact])

  const handleNumpadBackspace = React.useCallback(() => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: removePhoneDigit(c.phone) }))
    } else if (activeNumericField === "pin") {
      setStudentPin((prev) => prev.slice(0, -1))
    } else if (activeNumericField === "pin-confirm") {
      setStudentPinConfirm((prev) => prev.slice(0, -1))
    }
  }, [activeNumericField, setContact])

  const handleNumpadClear = React.useCallback(() => {
    if (activeNumericField === "phone") {
      setContact((c) => ({ ...c, phone: "+1 " }))
    } else if (activeNumericField === "pin") {
      setStudentPin("")
    } else if (activeNumericField === "pin-confirm") {
      setStudentPinConfirm("")
    }
  }, [activeNumericField, setContact])

  const advanceFromContactStep = React.useCallback(async () => {
    if (!isCheckInFlow) {
      setStep(step + 1)
      return
    }

    setIdentityCheckBusy(true)
    setFormError(null)
    try {
      // PIN availability check FIRST for new students - before any SMS verification
      // This prevents wasting the user's time verifying SMS only to find the PIN is taken
      if (service === "new-student" && /^\d{4}$/.test(studentPin) && studentPin === studentPinConfirm) {
        const pinAvailable = await checkPinAvailability(studentPin)
        if (!pinAvailable) return
      }

      if (service === "new-student" && isKioskTerminalFlow && isCompleteUSPhone(contact.phone)) {
        // Kiosk new-student flow: use the verification state machine
        const result = await verifyNewStudent(contact.phone, contact.email)
        if (handleExistingUserDetected({
          isKioskTerminalFlow,
          service,
          verifyResult: result,
          onExistingUserDetected,
        })) {
          // Parent (CheckInQrClient) handles transition to PIN flow
          return
        }
        if (result === "sms_pending") {
          // Create the Clerk user via backend BEFORE showing EmbeddedSignIn.
          // This ensures signIn.create() works (user must exist in Clerk first).
          const account = await requestAccountPreparation()
          if (!account) return
          // EmbeddedSignIn will render via JSX conditional on verification.state
          // Flow continues after SMS verification via the verified effect below
          return
        }
        // If somehow already verified, continue to account prep below
      } else if (service === "new-student" && !isKioskTerminalFlow && isCompleteUSPhone(contact.phone)) {
        // Non-kiosk new-student flow: keep existing behavior
        const verifyResult = await requestNewStudentOutcome()
        if (!verifyResult) return

        if (verifyResult.shouldFallbackToRegular || verifyResult.outcome === "fallback_regular") {
          showRegularFallbackPopup(verifyResult.message)
          return
        }

        if (verifyResult.requiresSmsVerification || verifyResult.outcome === "requires_sms_verification") {
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

      // PIN check was already done at the beginning of this function

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

      // Go to packages step if it exists, otherwise payments
      if (packagesStepIndex >= 0) {
        setStep(packagesStepIndex)
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
    checkPinAvailability,
    contact.email,
    contact.phone,
    isCheckInFlow,
    isKioskTerminalFlow,
    isSignedIn,
    onExistingUserDetected,
    packagesStepIndex,
    paymentsStepIndex,
    photoPolicy,
    photoSaved,
    photoStepIndex,
    preparedAccount,
    requestAccountPreparation,
    requestNewStudentOutcome,
    setExistingAccountDetected,
    setFormError,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setSignInPurpose,
    setStep,
    service,
    showRegularFallbackPopup,
    step,
    studentPin,
    studentPinConfirm,
    verifyNewStudent,
  ])

  const requestStripeIntent = async (token?: string | null) => {
    const { res, data } = await requestCheckoutIntentApi({
      token,
      payload: buildCheckoutPayload(),
    })
    return { res, data }
  }

  const requestKioskCheckoutSession = React.useCallback(async (token?: string | null) => {
    const { res, data } = await requestCheckoutSessionApi({
      token,
      payload: buildCheckoutPayload(),
    })
    return { res, data }
  }, [buildCheckoutPayload])

  const requestCashCheckout = async (token?: string | null) => {
    const { res, data } = await requestCheckoutCashApi({
      token,
      payload: buildCheckoutPayload({ cashNote: contact.note || undefined }),
    })
    return { res, data }
  }

  const resetKioskQrCheckout = React.useCallback(() => {
    setKioskQrCheckout(createEmptyKioskQrCheckoutState())
  }, [setKioskQrCheckout])

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
        const { res: dropInRes, data: dropInData } = await requestDropInCheckInApi({
          payload: {
            ...(resolvedPaymentIntentId ? { paymentIntentId: resolvedPaymentIntentId } : {}),
            ...(resolvedPurchaseId ? { purchaseId: resolvedPurchaseId } : {}),
            courseSlug: course.slug,
            date,
            time,
            durationMinutes: checkInContextDuration,
          },
        })
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
  }, [getToken, isSignedIn, requestKioskCheckoutSession, setFormError, setKioskQrCheckout])

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

      // Only auto-check-in if payment is confirmed (not pending cash)
      if (isCheckInFlow && !pkg && date && time && typeof result.data?.purchaseId === "string" && result.data?.paymentStatus !== "pending") {
        try {
          const { res: dropInRes, data: dropInData } = await requestDropInCheckInApi({
            token,
            payload: {
              purchaseId: result.data.purchaseId,
              courseSlug: course.slug,
              date,
              time,
              durationMinutes: checkInContextDuration,
            },
          })
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
  }, [pendingAutoPay, isSignedIn, processing, getToken, setRequiresSignIn])

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
    setExistingAccountDetected,
    setFormError,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setService,
    setStep,
    service,
    steps.length,
  ])

  React.useEffect(() => {
    if (!open) return
    setStep((prev) => Math.max(0, Math.min(prev, steps.length - 1)))
  }, [open, steps.length, setStep])

  // Kiosk new-student: after SMS verification succeeds, continue to account prep
  React.useEffect(() => {
    if (verificationState !== "verified" || !isKioskTerminalFlow) return
    let cancelled = false
    void (async () => {
      const account = preparedAccount || (await requestAccountPreparation())
      if (cancelled || !account) return
      const needsPhoto = isPhotoRequiredForAccount(photoPolicy, Boolean(account.hasAvatar || photoSaved))
      if (needsPhoto && photoStepIndex >= 0) {
        setStep(photoStepIndex)
      } else if (packagesStepIndex >= 0) {
        setStep(packagesStepIndex)
      } else if (paymentsStepIndex >= 0) {
        setStep(paymentsStepIndex)
      }
      resetVerification()
    })()
    return () => { cancelled = true }
  }, [verificationState, isKioskTerminalFlow, preparedAccount, requestAccountPreparation, photoPolicy, photoSaved, photoStepIndex, packagesStepIndex, paymentsStepIndex, resetVerification, setStep])

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

  // Notify the parent (e.g. CheckInQrClient) once we reach a target step
  // (packages or payments) AND the internal kiosk transition overlay has cleared.
  // This lets the outer full-screen resolving overlay stay up until the UI is truly
  // visible — not just until the EnrollModal has been opened.
  React.useEffect(() => {
    if (!open) {
      paymentsReadyFiredRef.current = false
      return
    }
    notifyPaymentsStepReadyForOpenSession({
      open,
      hasFired: paymentsReadyFiredRef.current,
      activeStepKey,
      showKioskPaymentTransition,
      markFired: () => {
        paymentsReadyFiredRef.current = true
      },
      onPaymentsStepReadyAction,
    })
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

    return createKioskQrPoller({
      sessionId: kioskQrCheckout.sessionId,
      onOutcome: async (outcome) => {
        if (outcome.type === "complete") {
          const completionMessage = await completeDropInCheckInAfterCardPayment({
            purchaseId: outcome.purchaseId,
          })
          setSuccessMessage(
            completionMessage ||
              (outcome.paymentStatus
                ? `Payment recorded successfully (${outcome.paymentStatus}).`
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

        if (outcome.type === "error") {
          console.warn("Unable to poll hosted checkout session status", outcome.error)
          setKioskQrCheckout((prev) => ({
            ...prev,
            phase: "error",
            awaitingWebhook: false,
            error: outcome.message,
          }))
          return
        }

        setKioskQrCheckout((prev) => ({
          ...prev,
          ...outcome.state,
        }))
      },
    })
  }, [
    completeDropInCheckInAfterCardPayment,
    isKioskTerminalFlow,
    kioskQrCheckout.sessionId,
    kioskQrCheckoutPending,
    open,
    setExistingAccountDetected,
    setKioskQrCheckout,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setSuccess,
    setSuccessMessage,
  ])

  const stepValid = (s: number) => {
    const stepKey = steps[s]?.key
    switch (stepKey) {
      case "party":
        // Paquete ahora es opcional según pedido; solo servicio y participantes
        return participants >= 1 && availableServices.some((opt) => opt.id === service)
      case "datetime":
        return Boolean(date) && Boolean(time) && !consecutiveOfferLoading
      case "info":
        const baseValid = contact.firstName.trim().length > 1 && contact.email.trim().length > 5 && isCompleteUSPhone(contact.phone)
        if (!baseValid) return false
        if (service === "new-student") {
          return /^\d{4}$/.test(studentPin) && studentPin === studentPinConfirm
        }
        return true
      case "photo":
        return !requiresPhotoStep || photoSaved
      case "packages":
        // Packages step is always valid - package selection is optional
        return true
      case "consecutive":
        return consecutiveChoiceMade
      case "payments":
        return paymentMethod !== "" && !consecutiveOfferLoading
      case "review":
        return true
      default:
        return false
    }
  }

  const canContinue = stepValid(step)
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
  }, [
    regularServicePrice,
    setExistingAccountDetected,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setSignInPurpose,
    showRegularFallbackPopup,
    signInPurpose,
  ])

  if (!open && !isInline) return null

  return (
    <div
      role={isInline ? "region" : "dialog"}
      aria-modal={isInline ? undefined : true}
      aria-label={t("aria_dialog_bookingFor", { title: course.title })}
      className={
        isInline
          ? "w-full"
          : "fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4"
      }
    >
      {!isInline && (
        <button
          aria-label={t("aria_close")}
          onClick={preventOutsideClose ? undefined : handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
      )}

      <GlassyCard
        data-lenis-prevent
        className={[
          "relative w-full p-0",
          forceKioskDarkModal
            ? "kiosk-terminal-enroll-modal border-white/12 bg-neutral-900/82 text-white shadow-[0_28px_90px_-44px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            : "bg-white/70 dark:bg-white/10",
          isInline
            ? "rounded-3xl overflow-hidden"
            : [
              "w-full md:w-[50rem] max-w-[min(50rem,92vw)] mx-auto max-h-[90vh] rounded-2xl",
              showStripeModal
                ? "sm:h-auto sm:min-h-[50rem] overflow-hidden"
                : "overflow-y-auto",
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

        <div className={[
          isInline ? "grid grid-cols-1 md:grid-cols-1" : "grid grid-cols-1 md:grid-cols-12",
          forceKioskDarkModal ? "dark" : "",
        ].join(" ")}>
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
                  <nav aria-label="Breadcrumb" className="mt-2 text-[11px] text-white/80 overflow-hidden">
                    {(() => {
                      // Show max 3 steps at a time, sliding window based on current step
                      const maxVisible = 3
                      const start = Math.max(0, Math.min(step - 1, steps.length - maxVisible))
                      const visible = steps.slice(start, start + maxVisible)
                      return (
                        <div 
                          className="flex items-center gap-1.5 transition-transform duration-300 ease-out"
                          style={{ transform: `translateX(0)` }}
                        >
                          {visible.map((st, idx) => {
                            const realIndex = start + idx
                            const done = realIndex < step && stepValid(realIndex)
                            const active = realIndex === step
                            const canJump = realIndex <= step
                            return (
                              <React.Fragment key={st.key}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canJump) return
                                    setStep(realIndex)
                                  }}
                                  disabled={!canJump}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition whitespace-nowrap ${
                                    active ? "border-white/40 bg-white/10" : "border-white/10 bg-transparent"
                                  } ${canJump ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed"}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-green-400" : active ? "bg-white" : "bg-white/30"}`} />
                                  <span>{st.label}</span>
                                </button>
                                {idx < visible.length - 1 && <span className="text-white/30">/</span>}
                              </React.Fragment>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </nav>
                )}

                {/* Summary - show booking summary or business info based on step */}
                {activeStepKey !== "payments" ? (
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
                ) : (
                  /* Payment helper for payments step */
                  <div className="mt-4 space-y-4">
                    {/* Add to Calendar hint */}
                    <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-center">
                      <p className="text-white/60">After completing your booking, you&apos;ll be able to add it to your calendar</p>
                    </div>
                  </div>
                )}

                {/* Sin bloque de contacto; el chat vive en el UI global */}
                </>
              )}
            </aside>
          )}

          {/* Main content */}
          <section
            data-kiosk-terminal-panel={forceKioskDarkModal ? "main" : undefined}
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
                    {activeStepKey === "packages"
                      ? course.title
                      : activeStepKey === "consecutive"
                        ? "Promotion for the Second Class"
                        : activeStepKey === "payments"
                          ? "Payment for Salsa Class"
                        : `${steps[step]?.label} • ${course.title}`}
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
                                  {p.price != null && <span className="text-sm font-semibold">{formatEnrollmentOptionPrice(p.price)}</span>}
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
                  <EnrollInfoStep
                    activeNumericField={activeNumericField}
                    checkPinAvailability={checkPinAvailability}
                    contact={contact}
                    handleNumpadBackspace={handleNumpadBackspace}
                    handleNumpadClear={handleNumpadClear}
                    handleNumpadDigit={handleNumpadDigit}
                    isCheckInFlow={isCheckInFlow}
                    isKioskTerminalFlow={isKioskTerminalFlow}
                    phoneTouched={phoneTouched}
                    pinAvailabilityError={pinAvailabilityError}
                    service={service}
                    setActiveNumericField={setActiveNumericField}
                    setContact={setContact}
                    setExistingAccountDetected={setExistingAccountDetected}
                    setPendingAutoPay={setPendingAutoPay}
                    setPhoneTouched={setPhoneTouched}
                    setPinAvailabilityError={setPinAvailabilityError}
                    setRequiresSignIn={setRequiresSignIn}
                    setResumeAfterSignInStep={setResumeAfterSignInStep}
                    setStudentPin={setStudentPin}
                    setStudentPinConfirm={setStudentPinConfirm}
                    shouldMaskKioskInfoContent={shouldMaskKioskInfoContent}
                    studentPin={studentPin}
                    studentPinConfirm={studentPinConfirm}
                    t={t}
                  />
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
                      onSkipped={() => {
                        // Pre-compute target index using the step array that will exist AFTER
                        // photoSaved=true removes the photo step (avoids stale-closure index shift)
                        const postSkipKeys = resolveEnrollStepKeys({
                          isCheckInFlow,
                          isQrMobileCompactFlow,
                          isCheckInNewFlow,
                          isKioskTerminalFlow,
                          requiresPhotoStep: false,
                          skipInfoStep: skipContactStep,
                          hasPackages: (course?.enrollment?.packages?.length ?? 0) > 0,
                          hasConsecutiveOffer: Boolean(effectiveConsecutiveOffer),
                        })
                        const packagesIdx = postSkipKeys.indexOf("packages")
                        const consecutiveIdx = postSkipKeys.indexOf("consecutive")
                        const paymentsIdx = postSkipKeys.indexOf("payments")
                        const targetStep = packagesIdx >= 0
                          ? packagesIdx
                          : consecutiveIdx >= 0
                            ? consecutiveIdx
                            : paymentsIdx >= 0
                              ? paymentsIdx
                              : postSkipKeys.length - 1

                        setPhotoSaved(true)
                        setStep(targetStep)
                      }}
                    />
                  </div>
                )}

                {/* Packages step (kiosk only, after user info) */}
                {activeStepKey === "packages" && (
                  <div className="space-y-4">
                    {/* Grid: 2 cols to match info step layout */}
                    <div className={`grid grid-cols-1 gap-3 ${course.enrollment.packages.length > 1 ? "sm:grid-cols-2" : ""}`}>
                      {course.enrollment.packages.map((p, index) => {
                        const selected = pkg === p.id
                        const metaLine = formatPackageMeta(p)
                        const descriptionLine = p.description || metaLine
                        const shouldShowMetaLine = Boolean(p.description && metaLine && metaLine !== p.description)
                        const packageCardBackgrounds = [
                          "bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_34%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))]",
                          "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(182,22,22,0.18),transparent_36%),linear-gradient(145deg,rgba(48,49,55,0.94),rgba(20,21,28,0.98))]",
                          "bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.22),transparent_34%),radial-gradient(circle_at_center_right,rgba(255,255,255,0.09),transparent_38%),linear-gradient(145deg,rgba(50,48,54,0.95),rgba(19,18,25,0.99))]",
                        ]
                        const packageCardBackground = packageCardBackgrounds[index % packageCardBackgrounds.length]
                        const isLastOddPackage = course.enrollment.packages.length > 1 &&
                          course.enrollment.packages.length % 2 === 1 &&
                          index === course.enrollment.packages.length - 1
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPkg(selected ? "" : p.id)}
                            className={`relative min-h-[10.5rem] w-full overflow-hidden rounded-[1.35rem] border px-5 py-5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${isLastOddPackage ? "sm:col-span-2" : ""} ${packageCardBackground} ${
                              selected
                                ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
                                : "border-white/14 hover:border-white/24 hover:brightness-110"
                            }`}
                          >
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
                            <div className="relative flex h-full flex-col gap-4">
                              <div className="flex items-start justify-between gap-4">
                                <p className="min-w-0 text-base font-semibold uppercase tracking-[-0.01em] text-white">{p.label}</p>
                                {p.price != null && (
                                  <p className="shrink-0 text-right text-xl font-semibold text-white">{formatEnrollmentOptionPrice(p.price)}</p>
                                )}
                              </div>
                              {descriptionLine && (
                                <p className="w-full text-sm leading-relaxed text-white/68">{descriptionLine}</p>
                              )}
                              {shouldShowMetaLine && (
                                <p className="mt-auto w-full text-xs text-white/48">{metaLine}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => setPkg("")}
                        className={`relative min-h-[10.5rem] w-full overflow-hidden rounded-[1.35rem] border px-5 py-5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${course.enrollment.packages.length > 1 ? "sm:col-span-2" : ""} bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(182,22,22,0.22),transparent_36%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))] ${
                          !pkg
                            ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
                            : "border-white/14 hover:border-white/24 hover:brightness-110"
                        }`}
                      >
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
                        <div className="relative flex h-full flex-col gap-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-base font-semibold uppercase tracking-[-0.01em] text-white">Drop-in</p>
                              <p className="mt-1 text-xs text-white/50">{course.title} / {to12h(time)}</p>
                            </div>
                            <p className="shrink-0 text-right text-xl font-semibold text-white">${isCheckInNewFlow ? "15" : "20"}</p>
                          </div>
                          <p className="w-full text-sm leading-relaxed text-white/68">
                            {isCheckInNewFlow ? "First-time student single class." : "Single class without a package."}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Consecutive class offer step before payments */}
                {activeStepKey === "consecutive" && effectiveConsecutiveOffer && (
                  <div className="space-y-4">
                    {(() => {
                      const consecutivePriceCents = effectiveIsPackageHolder
                        ? (effectiveConsecutiveOffer.packageHolderConsecutiveCents ?? 0)
                        : (effectiveConsecutiveOffer.dropInConsecutiveCents ?? 0)
                      const regularPriceCents = effectiveConsecutiveOffer.regularDropInCents ?? 0
                      const selectPromo = () => {
                        setConsecutiveAccepted(true)
                        setConsecutiveChoiceMade(true)
                        setConsecutiveAddedCents(consecutivePriceCents)
                      }
                      const declinePromo = () => {
                        setConsecutiveAccepted(false)
                        setConsecutiveChoiceMade(true)
                        setConsecutiveAddedCents(0)
                      }
                      return (
                        <>
                          <button
                            type="button"
                            onClick={selectPromo}
                            className={`relative w-full overflow-hidden rounded-[1.35rem] border px-5 py-5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(182,22,22,0.22),transparent_36%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))] ${
                              consecutiveAccepted && consecutiveChoiceMade
                                ? "border-emerald-400/70 ring-2 ring-emerald-400/25"
                                : "border-white/14 hover:border-white/24 hover:brightness-110"
                            }`}
                          >
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
                            <div className="relative flex flex-col gap-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                    Promo
                                  </span>
                                  <h3 className="mt-3 text-lg font-semibold text-white">{effectiveConsecutiveOffer.linkedCourseTitle}</h3>
                                  {effectiveConsecutiveOffer.linkedCourseTime && (
                                    <p className="mt-1 text-sm text-white/55">{to12h(effectiveConsecutiveOffer.linkedCourseTime)}</p>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-2xl font-bold text-emerald-300">${(consecutivePriceCents / 100).toFixed(2)}</p>
                                  {regularPriceCents > 0 && (
                                    <p className="mt-1 text-sm font-semibold text-red-300 line-through">${(regularPriceCents / 100).toFixed(2)}</p>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed text-white/68">
                                Add your second class at a special price. This will be added to your payment.
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={declinePromo}
                            className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                              consecutiveChoiceMade && !consecutiveAccepted
                                ? "border-white/35 bg-white/[0.08] text-white ring-2 ring-white/10"
                                : "border-white/12 bg-white/[0.03] text-white/72 hover:border-white/22 hover:text-white"
                            }`}
                          >
                            Continue without promotion
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}

                {activeStepKey === "payments" && (
                  <div className="space-y-4">
                    {/* Selected package card with remove action (kiosk flows) */}
                    {isCheckInFlow && pkg && (
                      <div className="rounded-xl border border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.08)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-neutral-500 dark:text-white/60 uppercase tracking-wide mb-1">Selected Package</p>
                            <p className="text-base font-semibold">{course.enrollment.packages.find((p) => p.id === pkg)?.label}</p>
                            {course.enrollment.packages.find((p) => p.id === pkg)?.price != null && (
                              <p className="mt-1 text-sm font-medium">{formatEnrollmentOptionPrice(course.enrollment.packages.find((p) => p.id === pkg)?.price)}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setStep(stepKeys.indexOf("packages"))}
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-white/70 hover:bg-white/80 dark:hover:bg-white/20 transition"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                    {/* No package selected info (kiosk flows) */}
                    {isCheckInFlow && !pkg && isKioskTerminalFlow && course.enrollment.packages.length > 0 && (
                      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-neutral-500 dark:text-white/60 uppercase tracking-wide mb-1">Package</p>
                            <p className="text-sm text-neutral-600 dark:text-white/70">Single class (no package)</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStep(stepKeys.indexOf("packages"))}
                            className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-white/70 hover:bg-white/80 dark:hover:bg-white/20 transition"
                          >
                            Add Package
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Payments step */}
                    <div className="relative overflow-hidden rounded-[1.15rem] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%),linear-gradient(145deg,rgba(44,45,55,0.96),rgba(19,20,27,0.99))] p-4 text-white shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)]">
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
                      <div className="relative space-y-4">
                        {isCheckInFlow && (
                          <>
                            <div>
                              <div className="text-sm font-semibold text-white">{t("reviewAndConfirm")}</div>
                              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-white/68 sm:grid-cols-2">
                                <div>{t("course")}: <span className="text-white">{course.title}</span></div>
                                <div>{t("service")}: <span className="text-white">{course.enrollment.services.find((s)=>s.id===service)?.label}{pkgOpt ? " (included in package)" : ""}</span></div>
                                <div>{t("dateTime")}: <span className="text-white">{date} {to12h(time)}</span></div>
                                <div>{t("people")}: <span className="text-white">{participants}</span></div>
                                <div>{t("name")}: <span className="text-white">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</span></div>
                                <div>{t("email")}: <span className="text-white">{contact.email || "—"}</span></div>
                                <div>Phone: <span className="text-white">{contact.phone || "—"}</span></div>
                                {!!addons.length && (
                                  <div>{t("extras")}: <span className="text-white">{addons.map((a)=>course.enrollment.addons?.find(x=>x.id===a)?.label).filter(Boolean).join(", ")}</span></div>
                                )}
                                {pkg && (
                                  <div>{t("package")}: <span className="text-white">{course.enrollment.packages.find((p)=>p.id===pkg)?.label || "—"}</span></div>
                                )}
                                {contact.note && <div className="sm:col-span-2">{t("notes")}: <span className="text-white">{contact.note}</span></div>}
                              </div>
                            </div>
                            <div className="h-px bg-white/12" aria-hidden />
                          </>
                        )}

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-white/48">{t("payments_classes")}</div>
                          <div className="mt-1 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold leading-snug text-white">
                                {course.title}{time ? ` · ${to12h(time)}` : ""} — {course.enrollment.services.find((s)=>s.id===service)?.label}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                                {date && <span>Date: {date}{time ? ` · ${to12h(time)}` : ""}</span>}
                                {course.location?.address && <span>Address: {course.location.address}</span>}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                                <span>{participants} {participants===1?t("onePerson"):t("manyPeople")}</span>
                                <span>Service: {serviceOpt?.label || "—"}{pkgOpt ? " (included)" : ""}</span>
                                {pkgOpt && <span>Package: {pkgOpt.label}</span>}
                                {!!addonsOpts.length && <span>Extras: {addonsOpts.map((a)=>a.label).join(", ")}</span>}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-white">${subtotal.toFixed(2)}</span>
                          </div>
                          {consecutiveAccepted && effectiveConsecutiveOffer && (
                            <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold leading-snug text-white">
                                  + {effectiveConsecutiveOffer.linkedCourseTitle}{effectiveConsecutiveOffer.linkedCourseTime ? ` · ${to12h(effectiveConsecutiveOffer.linkedCourseTime)}` : ""}
                                </div>
                                <div className="mt-0.5 text-[11px] text-emerald-300/70">
                                  Second class promotion
                                </div>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-emerald-300">${(consecutiveAddedCents / 100).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pt-1">
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

                        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
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
                        disabled={!canContinue || identityCheckBusy || checkingPinAvailability}
                        className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
                      >
                        {identityCheckBusy
                          ? t("verifyingAccount")
                          : checkingPinAvailability
                            ? "Checking PIN..."
                            : consecutiveOfferLoading && (activeStepKey === "datetime" || activeStepKey === "payments")
                              ? "Checking promotions..."
                              : t("continue")}
                      </button>
                    ) : (
                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          disabled={!canContinue || processing || identityCheckBusy || kioskQrCheckoutLocked}
                          className={isInline ? "px-3 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50 text-sm" : "px-4 py-2 rounded-md bg-[var(--brand,#111)] text-white disabled:opacity-50"}
                        >
                          {processing
                            ? "Processing..."
                            : consecutiveOfferLoading && activeStepKey === "payments"
                              ? "Checking promotions..."
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
                  const { res: finalizeRes } = await requestCheckoutFinalizeApi({ token, paymentIntentId })
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
      {(verificationState === "sms_pending" || verificationState === "sms_verifying") && isKioskTerminalFlow && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("aria_close")}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              resetVerification()
            }}
          />
          <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)]">
            <div className="mb-4 flex items-start justify-end gap-3">
              <button
                type="button"
                className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/[0.04] transition"
                onClick={() => {
                  resetVerification()
                }}
              >
                {t("cancel")}
              </button>
            </div>
            {/* Code input + numpad */}
            <EmbeddedSignIn
              redirectUrl={signInReturnTo}
              phoneNumber={toE164Phone(contact.phone)}
              useNumericKeypad={isKioskTerminalFlow}
              activateSessionOnSuccess={false}
              bare
              onCodeSent={() => {
                verification.onSmsSent()
              }}
              onSessionCreated={(sessionId) => {
                handleEmbeddedSignInSessionCreated({ onKioskSessionCreated, sessionId })
              }}
              onSuccessAction={async () => {
                markSmsVerified()
              }}
            />
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
            <div className="mt-4">
              <EmbeddedSignIn
                redirectUrl={signInReturnTo}
                phoneNumber={toE164Phone(contact.phone)}
                useNumericKeypad={isKioskTerminalFlow}
                bare
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
