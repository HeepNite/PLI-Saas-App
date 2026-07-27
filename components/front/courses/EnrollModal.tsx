"use client"
import React from "react"
import { demoCourses, type EnrollmentOption } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import { useI18n } from "@/lib/i18n"
import type { Coupon, EnrollmentContact } from "./types"
import { useEnrollDraft } from "./hooks/useEnrollDraft"
import { formatUSPhone, hasPhoneDigits, isCompleteUSPhone, toE164Phone } from "./utils/phone"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { StripePaymentModal } from "../payments/StripePaymentModal"
import { useRouter } from "next/navigation"
import {
  computeCheckInAutofill as computeCheckInAutofillModel,
  formatCheckInSummaryDateTime as formatCheckInSummaryDateTimeModel,
} from "@/components/front/courses/enroll/model/checkin-autofill"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { useNewStudentVerification } from "./hooks/useNewStudentVerification"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import {
  getPhotoPolicy,
  isPhotoRequiredForAccount,
} from "@/lib/checkin/photo-context-policy"
import {
  handleEmbeddedSignInSessionCreated,
  notifyPaymentsStepReadyForOpenSession,
  shouldFetchConsecutiveOffer,
  shouldIncludePhotoStep,
  shouldRedirectPersonalCompletion,
} from "@/lib/checkin/enroll-flow"
import {
  getKioskPaymentTransitionRemainingMs,
  isKioskCardFastPathEligible,
  isKioskInfoFastPathEligible,
  isKioskQrPendingPhase,
  shouldAutoAdvanceKioskInfoStep,
  shouldMaskKioskInfoStep,
} from "@/lib/checkin/kiosk-qr-payment"
import {
  resolveCheckInServiceSelection,
} from "@/lib/checkin/new-student-flow"
import { createInitialEnrollFlowState, enrollFlowReducer } from "@/components/front/courses/enroll/model/enroll-flow.reducer"
import { resolveAvailableEnrollServices } from "@/components/front/courses/enroll/model/enroll-services"
import { validateEnrollBeforeSubmit } from "@/components/front/courses/enroll/model/enroll-validation"
import EnrollSidebar from "@/components/front/courses/enroll/steps/EnrollSidebar"
import EnrollSignInOverlay from "@/components/front/courses/enroll/steps/EnrollSignInOverlay"
import EnrollFlowPopup from "@/components/front/courses/enroll/steps/EnrollFlowPopup"
import EnrollStepRouter from "@/components/front/courses/enroll/steps/EnrollStepRouter"
import EnrollFormFooter from "@/components/front/courses/enroll/steps/EnrollFormFooter"
import EnrollSuccessView from "@/components/front/courses/enroll/steps/EnrollSuccessView"
import { initialKioskInfoPhase, type KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import { useEnrollNavigationActions } from "@/components/front/courses/enroll/hooks/useEnrollNavigationActions"
import { useEnrollPaymentActions } from "@/components/front/courses/enroll/hooks/useEnrollPaymentActions"
import {
  requestCheckoutFinalizeApi,
} from "@/components/front/courses/enroll/effects/checkout-api"
import { resolveStepValid } from "@/components/front/courses/enroll/model/enroll-step-valid"
import { useConsecutiveOffer } from "@/components/front/courses/enroll/hooks/useConsecutiveOffer"
import { useEnrollInit } from "@/components/front/courses/enroll/hooks/useEnrollInit"
import { useKioskInactivity } from "@/components/front/courses/enroll/hooks/useKioskInactivity"
import { useKioskQrPoller } from "@/components/front/courses/enroll/hooks/useKioskQrPoller"
import { useEnrollFlowSetters } from "@/components/front/courses/enroll/hooks/useEnrollFlowSetters"
import { useEnrollDerivedState } from "@/components/front/courses/enroll/hooks/useEnrollDerivedState"
import { useEnrollSubmitActions } from "@/components/front/courses/enroll/hooks/useEnrollSubmitActions"
import type {
  EnrollModalProps,
  FlowPopupState,
  PreparedAccountState,
} from "@/components/front/courses/enroll/types/enroll-modal-props"

// EnrollModal: popup demo to select service, package, add-ons, date, time, and basic contact data.
// - This is a client-only component. It does not call a backend; it shows a local success state.
//   Replace the `handleSubmit` implementation with a real API
//   call when you are ready.
// - All inputs are controlled in the local state for simplicity.

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
}: EnrollModalProps) {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const { t } = useI18n()
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const { setActive } = useClerk()
  const pendingClerkSessionRef = React.useRef<string | null>(null)
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
  const isProfileBookingFlow = compactBookingSource === "profile-booking"
  const usesCompactCheckInExperience = isCheckInFlow || isQrMobileCompactFlow
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"
  const usesPhasedInfoForm = isKioskTerminalFlow || (isQrMobileCompactFlow && isCheckInNewFlow)
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
  const [activeNumericField, setActiveNumericField] = React.useState<"phone" | null>(() =>
    isKioskTerminalFlow ? "phone" : null
  )
  const [kioskInfoPhase, setKioskInfoPhase] = React.useState<KioskInfoPhase>(() =>
    initialKioskInfoPhase({ phoneFirst: isKioskTerminalFlow })
  )
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
  const kioskFastPathAdvanceTriggeredRef = React.useRef(false)
  const kioskFastPathSubmitTriggeredRef = React.useRef(false)
  const isNewStudent = service === "new-student"
  // A user who selects a package during the same flow counts as a package holder for consecutive pricing.
  const effectiveIsPackageHolder = isPackageHolder || Boolean(pkg)
  const resetConsecutiveChoice = React.useCallback(() => setConsecutiveChoiceMade(false), [])
  const resetConsecutiveAccepted = React.useCallback(() => setConsecutiveAccepted(false), [])
  const resetConsecutiveAddedCents = React.useCallback(() => setConsecutiveAddedCents(0), [])
  const { fetchedOffer: fetchedConsecutiveOffer, offerLoading: consecutiveOfferLoading } = useConsecutiveOffer({
    courseSlug: course.slug,
    date,
    time,
    consecutiveOffer,
    enabled: shouldFetchConsecutiveOffer({ isQrMobileCompactFlow, isCheckInFlow, isProfileBookingFlow }),
    resetChoice: resetConsecutiveChoice,
    resetAccepted: resetConsecutiveAccepted,
    resetAddedCents: resetConsecutiveAddedCents,
  })
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
  const {
    hasNewStudentService,
    courseAvailableWeekdays,
    regularServiceId,
    stepKeys,
    steps,
    paymentsStepIndex,
    infoStepIndex,
    photoStepIndex,
    packagesStepIndex,
    promoStepIndex,
    regularServicePrice,
    regularFallbackLocked,
    effectiveInitialStep,
    signInModalVariant,
    kioskPaymentTransitionMessage,
    currentUserContact,
    pricing,
    calendarLinks,
    getCurrentCourseTimesForDate,
    visibleTimeSlots,
    isSlotExpiredForCheckIn,
    formattedSummaryDateTime,
    stepValidCtx,
  } = useEnrollDerivedState({
    course,
    sourceCourses,
    isCheckInFlow,
    isCheckInNewFlow,
    isCheckInExistingFlow,
    isKioskTerminalFlow,
    isQrMobileCompactFlow,
    isProfileBookingFlow,
    skipContactStep,
    initialStep,
    newStudentFallbackPhoneKey,
    contact,
    service,
    pkg,
    addons,
    participants,
    date,
    time,
    appliedCoupon,
    consecutiveAccepted,
    consecutiveAddedCents,
    effectiveConsecutiveOffer,
    requiresPhotoStep,
    photoSaved,
    consecutiveChoiceMade,
    consecutiveOfferLoading,
    paymentMethod,
    checkInNow,
    user,
  })

  const forcedNewStudentServiceId = hasNewStudentService
    ? "new-student"
    : (availableServices[0]?.id ?? "")

  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    setCheckInNow(new Date())
    const intervalId = window.setInterval(() => setCheckInNow(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [isCheckInFlow, open])

  const signInReturnTo = React.useMemo(() => {
    const base = `/courses/${course.slug}?enroll=1&step=${Math.max(0, Math.min(steps.length - 1, step))}`
    if (!isQrMobileCompactFlow) return base
    const extras = [
      "qrBooking=1",
      checkInContextDate && `date=${checkInContextDate}`,
      checkInContextTime && `time=${checkInContextTime}`,
    ].filter(Boolean).join("&")
    return extras ? `${base}&${extras}` : base
  }, [course.slug, steps.length, step, isQrMobileCompactFlow, checkInContextDate, checkInContextTime])
  const draftKey = React.useMemo(() => `pli-enroll:${course.slug}`, [course.slug])

  const {
    setService,
    setPkg,
    setAddons,
    setParticipants,
    setContact,
    setPaymentMethod,
    setStep,
    setSuccess,
    setSuccessMessage,
    setProcessing,
    setFormError,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setKioskQrCheckout,
    setSignInPurpose,
  } = useEnrollFlowSetters(dispatchFlow, steps.length)

  const initialServiceId = React.useMemo(() => {
    if (isCheckInNewFlow) return forcedNewStudentServiceId
    if (isCheckInExistingFlow) return regularServiceId
    return availableServices[0]?.id ?? ""
  }, [availableServices, forcedNewStudentServiceId, isCheckInExistingFlow, isCheckInNewFlow, regularServiceId])

  const { openInitializationRef, prefillContactRef, prefillSelectionRef, userContactRef } = useEnrollInit({
    open,
    prefillContact,
    prefillSelection,
    userContact: currentUserContact,
    course,
    sourceCourses,
    availableServices,
    draftKey,
    initialServiceId,
    useDraft,
    isCheckInNewFlow,
    isCheckInFlow,
    isCheckInExistingFlow,
    isKioskTerminalFlow,
    isQrMobileCompactFlow,
    checkInContextDate,
    checkInContextTime,
    effectiveInitialStep,
    kioskFastPathAdvanceTriggeredRef,
    kioskFastPathSubmitTriggeredRef,
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
    setCheckInScheduleNotice,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setPendingAutoPay,
    setIdentityCheckBusy,
    setPhoneTouched,
    setStripeClientSecret,
    setShowStripeModal,
    setKioskQrCheckout,
    setFormError,
    setKioskStepHydrating,
  })

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
    if (!shouldRedirectPersonalCompletion({ success, isPersonalCompletion })) return
    const sessionId = pendingClerkSessionRef.current
    if (sessionId) {
      setActive({ session: sessionId }).then(() => {
        router.replace("/client-profile")
      })
    } else {
      router.replace("/client-profile")
    }
  }, [isPersonalCompletion, router, setActive, success])

  useKioskInactivity({
    open,
    isStationCompletion,
    success,
    qrPhase: kioskQrCheckout.phase,
    onCompletedAction,
    onTimeoutAction,
  })

  // NOTE: body scroll-lock is owned solely by useEnrollEffects. A second
  // identical lock here caused a double-lock: the second effect captured
  // `prev = "hidden"` and restored the body to "hidden" on close, leaving the
  // page (e.g. the profile the flow redirects to) frozen/unscrollable.


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

  // No early returns before hooks complete. We will conditionally render at the final return

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

  const formatPackageMeta = React.useCallback((option?: EnrollmentOption | null) => {
    if (!option?.meta) return option?.description
    const parts: string[] = []
    if (option.meta.cadence) parts.push(option.meta.cadence)
    if (option.meta.totalClasses && option.meta.totalClasses > 0) parts.push(`${option.meta.totalClasses} classes`)
    if (option.meta.makeUps && option.meta.makeUps > 0) parts.push(`+${option.meta.makeUps} make-ups`)
    return parts.join(" • ") || option.description
  }, [])

  // Helpers
  const to12h = (value: string) => to12hLabel(value)
  const summaryDateTimeValue = isKioskTerminalFlow
    ? formattedSummaryDateTime
    : <>{date || "—"} {to12h(time) || ""}</>

  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    const recommended = computeCheckInAutofill(
      course.slug,
      sourceCourses,
      {
        date: checkInContextDate,
        time: checkInContextTime,
      },
      checkInNow,
      isKioskTerminalFlow || isQrMobileCompactFlow,
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
  const eventDates = calendarLinks.eventDates
  const googleCalHref = calendarLinks.googleCalHref
  const icsDataUri = calendarLinks.icsDataUri

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
      contactStepIndex: infoStepIndex,
      paymentMethod,
      paymentsStepIndex,
      total,
    })
  }

  const activeStepKey = steps[step]?.key || ""

  const {
    requestNewStudentOutcome,
    requestAccountPreparation,
    showRegularFallbackPopup,
    completeDropInCheckInAfterCardPayment,
    handleSubmit: handleSubmitInternal,
    resetKioskQrCheckout,
  } = useEnrollPaymentActions({
    course,
    service,
    pkg,
    addons,
    participants,
    date,
    time,
    contact,
    appliedCoupon,
    paymentMethod,
    total,
    photoFlowContext,
    kioskSessionToken,
    checkInContextDate,
    checkInContextTime,
    checkInContextDuration,
    consecutiveAccepted,
    consecutiveAddedCents,
    effectiveConsecutiveOffer,
    isCheckInFlow,
    isKioskTerminalFlow,
    isSignedIn,
    processing,
    step,
    paymentsStepIndex,
    infoStepIndex,
    regularServiceId,
    regularServicePrice,
    pendingAutoPay,
    getToken,
    setService,
    setStep,
    setSuccess,
    setSuccessMessage,
    setProcessing,
    setFormError,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setPendingAutoPay,
    setKioskQrCheckout,
    setSignInPurpose,
    setStripeClientSecret,
    setShowStripeModal,
    setPreparedAccount,
    setNewStudentFallbackPhoneKey,
    setFlowPopup,
    setResumeContactFlowAfterSignIn,
    t,
  })

  const handleSubmit = async (e?: React.FormEvent) => {
    await handleSubmitInternal(e, { validateBeforeSubmit })
  }

  const { resetForm, handleClose, handleSignInDismiss } = useEnrollSubmitActions({
    isKioskTerminalFlow,
    regularServicePrice,
    signInPurpose,
    onCloseAction,
    kioskPaymentTransitionTimeoutRef,
    kioskPaymentTransitionStartedAtRef,
    kioskFastPathAdvanceTriggeredRef,
    kioskFastPathSubmitTriggeredRef,
    setSuccess,
    setSuccessMessage,
    setAddons,
    setParticipants,
    setDate,
    setTime,
    setContact,
    setStep,
    setCheckInScheduleNotice,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setPendingAutoPay,
    setResumeContactFlowAfterSignIn,
    setIdentityCheckBusy,
    setPhoneTouched,
    setActiveNumericField,
    setKioskInfoPhase,
    setStripeClientSecret,
    setShowStripeModal,
    setKioskQrCheckout,
    setPreparedAccount,
    setPhotoSaved,
    setNewStudentFallbackPhoneKey,
    setFlowPopup,
    setSignInPurpose,
    setFormError,
    setProcessing,
    setShowKioskPaymentTransition,
    setConsecutiveAccepted,
    setConsecutiveAddedCents,
    setConsecutiveChoiceMade,
    showRegularFallbackPopup,
  })

  React.useEffect(() => {
    if (!open && !isInline) {
      resetForm()
      resetVerification()
    }
  }, [open, isInline, resetForm, resetVerification])

  const {
    handleNumpadDigit,
    handleNumpadBackspace,
    handleNumpadClear,
    advanceFromContactStep,
    handleFormStepSubmit,
  } = useEnrollNavigationActions({
    service,
    contact,
    isCheckInFlow,
    isKioskTerminalFlow,
    isQrMobileCompactFlow,
    isSignedIn,
    step,
    steps,
    photoPolicy,
    photoSaved,
    photoStepIndex,
    promoStepIndex,
    packagesStepIndex,
    paymentsStepIndex,
    usesPhasedInfoForm,
    activeStepKey,
    kioskInfoPhase,
    activeNumericField,
    preparedAccount,
    onExistingUserDetected,
    verifyNewStudent,
    resetVerification,
    setContact,
    setStep,
    setFormError,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn,
    setPendingAutoPay,
    setSignInPurpose,
    setIdentityCheckBusy,
    setPhoneTouched,
    setActiveNumericField,
    setKioskInfoPhase,
    setAddons,
    requestAccountPreparation,
    requestNewStudentOutcome,
    showRegularFallbackPopup,
    handleSubmit,
  })

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
      if (service === "new-student" && regularServiceId && regularServiceId !== service && !isQrMobileCompactFlow) {
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
    isQrMobileCompactFlow,
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

  // Kiosk & QR mobile new-student: after SMS verification succeeds, continue to account prep
  React.useEffect(() => {
    if (verificationState !== "verified" || !(isKioskTerminalFlow || isQrMobileCompactFlow)) return
    let cancelled = false
    void (async () => {
      const account = preparedAccount || (await requestAccountPreparation())
      if (cancelled || !account) return
      const needsPhoto = isPhotoRequiredForAccount(photoPolicy, Boolean(account.hasAvatar || photoSaved))
      if (needsPhoto && photoStepIndex >= 0) {
        setStep(photoStepIndex)
      } else if (promoStepIndex >= 0) {
        setStep(promoStepIndex)
      } else if (packagesStepIndex >= 0) {
        setStep(packagesStepIndex)
      } else if (paymentsStepIndex >= 0) {
        setStep(paymentsStepIndex)
      }
      resetVerification()
    })()
    return () => { cancelled = true }
  }, [verificationState, isKioskTerminalFlow, isQrMobileCompactFlow, preparedAccount, requestAccountPreparation, photoPolicy, photoSaved, photoStepIndex, promoStepIndex, packagesStepIndex, paymentsStepIndex, resetVerification, setStep])

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

  useKioskQrPoller({
    open,
    isKioskTerminalFlow,
    sessionId: kioskQrCheckout.sessionId,
    kioskQrCheckoutPending,
    completeDropInCheckInAfterCardPayment,
    setSuccessMessage,
    setSuccess,
    setRequiresSignIn,
    setExistingAccountDetected,
    setResumeAfterSignInStep,
    setPendingAutoPay,
    setKioskQrCheckout,
  })

  const stepValid = (s: number) => resolveStepValid(s, stepValidCtx)

  const canContinue = stepValid(step)
  const canContinueCurrentStep = usesPhasedInfoForm && activeStepKey === "info"
    ? kioskInfoPhase === "name-email"
      ? contact.firstName.trim().length > 1 && contact.email.trim().length > 5
      : isCompleteUSPhone(contact.phone)
    : canContinue
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
          className={`absolute inset-0 ${isQrMobileCompactFlow ? "bg-black" : "bg-black/60"} backdrop-blur-sm`}
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
            <EnrollSidebar
              isInline={isInline}
              success={success}
              isQrMobileCompactFlow={isQrMobileCompactFlow}
              isKioskTerminalFlow={isKioskTerminalFlow}
              activeStepKey={activeStepKey}
              step={step}
              steps={steps}
              course={course}
              service={service}
              pkg={pkg}
              addons={addons}
              participants={participants}
              contact={contact}
              summaryDateTimeValue={summaryDateTimeValue}
              summaryGridClass={summaryGridClass}
              total={total}
              googleCalHref={googleCalHref}
              icsDataUri={icsDataUri}
              eventDates={Boolean(eventDates)}
              courseSlug={course.slug}
              date={date}
              time={time}
              stepValidCtx={stepValidCtx}
              onStepClick={setStep}
              t={t}
            />
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
                      : activeStepKey === "promo"
                        ? "Deals & Promotions"
                        : activeStepKey === "consecutive"
                          ? "Promotion for the Second Class"
                          : activeStepKey === "payments"
                            ? (isQrMobileCompactFlow ? course.title : `Payment for ${course.title}`)
                            : `${steps[step]?.label} • ${course.title}`}
                  </h3>
                </div>
              )}

            {success ? (
              <EnrollSuccessView
                course={course}
                date={date}
                time={time}
                service={service}
                contact={contact}
                successMessage={successMessage}
                total={total}
                paymentMethodLabel={paymentMethodLabel}
                allowPanelAccess={allowPanelAccess}
                isPersonalCompletion={isPersonalCompletion}
                isStationCompletion={isStationCompletion}
                stationCompletionTimeoutRef={stationCompletionTimeoutRef}
                onCompletedAction={onCompletedAction}
                handleClose={handleClose}
                to12h={to12h}
                t={t}
              />
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  await handleFormStepSubmit()
                }}
                className="space-y-4"
              >
                {/* Step contents */}
                <EnrollStepRouter
                  activeStepKey={activeStepKey}
                  isInline={isInline}
                  isCheckInFlow={isCheckInFlow}
                  isCheckInNewFlow={isCheckInNewFlow}
                  isQrMobileCompactFlow={isQrMobileCompactFlow}
                  isKioskTerminalFlow={isKioskTerminalFlow}
                  isNewStudent={isNewStudent}
                  isCheckInExistingFlow={isCheckInExistingFlow}
                  isProfileBookingFlow={isProfileBookingFlow}
                  skipContactStep={skipContactStep}
                  availableServices={availableServices}
                  hasNewStudentService={hasNewStudentService}
                  course={course}
                  courseAvailableWeekdays={courseAvailableWeekdays}
                  service={service}
                  setService={setService}
                  participants={participants}
                  setParticipants={setParticipants}
                  pkg={pkg}
                  setPkg={setPkg}
                  addons={addons}
                  setAddons={setAddons}
                  contact={contact}
                  setContact={setContact}
                  date={date}
                  setDate={setDate}
                  time={time}
                  setTime={setTime}
                  initialLoading={initialLoading}
                  timeLoading={timeLoading}
                  setTimeLoading={setTimeLoading}
                  checkInScheduleNotice={checkInScheduleNotice}
                  setCheckInScheduleNotice={setCheckInScheduleNotice}
                  visibleTimeSlots={visibleTimeSlots}
                  isSlotExpiredForCheckIn={isSlotExpiredForCheckIn}
                  to12h={to12h}
                  getCurrentCourseTimesForDate={getCurrentCourseTimesForDate}
                  photoPolicy={photoPolicy}
                  preparedAccount={preparedAccount}
                  setPreparedAccount={setPreparedAccount}
                  setPhotoSaved={setPhotoSaved}
                  setFormError={setFormError}
                  requiresPhotoStep={requiresPhotoStep}
                  step={step}
                  steps={steps}
                  stepKeys={stepKeys}
                  setStep={setStep}
                  photoStepIndex={photoStepIndex}
                  effectiveConsecutiveOffer={effectiveConsecutiveOffer}
                  effectiveIsPackageHolder={effectiveIsPackageHolder}
                  consecutiveAccepted={consecutiveAccepted}
                  setConsecutiveAccepted={setConsecutiveAccepted}
                  consecutiveChoiceMade={consecutiveChoiceMade}
                  setConsecutiveChoiceMade={setConsecutiveChoiceMade}
                  consecutiveAddedCents={consecutiveAddedCents}
                  setConsecutiveAddedCents={setConsecutiveAddedCents}
                  kioskQrCheckoutLocked={kioskQrCheckoutLocked}
                  couponInput={couponInput}
                  setCouponInput={setCouponInput}
                  appliedCoupon={appliedCoupon}
                  setAppliedCoupon={setAppliedCoupon}
                  subtotal={subtotal}
                  total={total}
                  serviceOpt={serviceOpt}
                  pkgOpt={pkgOpt}
                  addonsOpts={addonsOpts}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paymentMethodLabel={paymentMethodLabel}
                  formatPackageMeta={formatPackageMeta}
                  activeNumericField={activeNumericField}
                  handleNumpadBackspace={handleNumpadBackspace}
                  handleNumpadClear={handleNumpadClear}
                  handleNumpadDigit={handleNumpadDigit}
                  kioskInfoPhase={kioskInfoPhase}
                  phoneTouched={phoneTouched}
                  setActiveNumericField={setActiveNumericField}
                  setExistingAccountDetected={setExistingAccountDetected}
                  setPendingAutoPay={setPendingAutoPay}
                  setPhoneTouched={setPhoneTouched}
                  setRequiresSignIn={setRequiresSignIn}
                  setResumeAfterSignInStep={setResumeAfterSignInStep}
                  setKioskInfoPhase={setKioskInfoPhase}
                  shouldMaskKioskInfoContent={shouldMaskKioskInfoContent}
                  usesPhasedInfoForm={usesPhasedInfoForm}
                  t={t}
                />

                <EnrollFormFooter
                  step={step}
                  steps={steps}
                  activeStepKey={activeStepKey}
                  isInline={isInline}
                  allowPanelAccess={allowPanelAccess}
                  usesPhasedInfoForm={usesPhasedInfoForm}
                  kioskInfoPhase={kioskInfoPhase}
                  kioskQrCheckoutLocked={kioskQrCheckoutLocked}
                  kioskQrCheckout={kioskQrCheckout}
                  isKioskTerminalFlow={isKioskTerminalFlow}
                  paymentMethod={paymentMethod}
                  processing={processing}
                  identityCheckBusy={identityCheckBusy}
                  consecutiveOfferLoading={consecutiveOfferLoading}
                  canContinueCurrentStep={canContinueCurrentStep}
                  handleClose={handleClose}
                  handleSubmit={handleSubmit}
                  resetKioskQrCheckout={resetKioskQrCheckout}
                  setStep={setStep}
                  setKioskInfoPhase={setKioskInfoPhase}
                  setActiveNumericField={setActiveNumericField}
                  t={t}
                />
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
        <EnrollFlowPopup
          title={flowPopup.title}
          message={flowPopup.message}
          onContinue={() => {
            setFlowPopup(null)
            void advanceFromContactStepRef.current()
          }}
        />
      )}
      {(verificationState === "sms_pending" || verificationState === "sms_verifying") && (isKioskTerminalFlow || isQrMobileCompactFlow) && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("aria_close")}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              resetVerification()
            }}
          />
          <div className="relative z-10 w-full max-w-[22rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
            <button
              type="button"
              className="absolute right-5 top-5 z-10 shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 transition hover:bg-white/[0.04]"
              onClick={() => {
                resetVerification()
              }}
            >
              {t("cancel")}
            </button>
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
                pendingClerkSessionRef.current = sessionId
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
        <EnrollSignInOverlay
          title={signInModalTitle}
          subtitle={signInModalSubtitle}
          variant={signInModalVariant}
          signInReturnTo={signInReturnTo}
          phoneE164={toE164Phone(contact.phone)}
          isKioskTerminalFlow={isKioskTerminalFlow}
          isCheckInFlow={isCheckInFlow}
          onDismiss={handleSignInDismiss}
          onSuccessAction={async () => {
            setFormError(null)
          }}
          cancelLabel={t("cancel")}
          backLabel={t("account_exists_back")}
          closeAriaLabel={t("aria_close")}
        />
      )}
    </div>
  )
}
