"use client"
import React from "react"
import { demoCourses } from "@/constants/courses"
import GlassyCard from "./GlassyCard"
import { useI18n } from "@/lib/i18n"
import type { Coupon, EnrollmentContact, PaymentMethod } from "./types"
import { useEnrollDraft } from "./hooks/useEnrollDraft"
import { toE164Phone, isCompleteUSPhone } from "./utils/phone"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { StripePaymentModal } from "../payments/StripePaymentModal"
import { useRouter } from "next/navigation"
import {
  computeCheckInAutofill as computeCheckInAutofillModel,
  formatCheckInSummaryDateTime as formatCheckInSummaryDateTimeModel,
} from "@/components/front/courses/enroll/model/checkin-autofill"
import EmbeddedSignIn from "@/components/front/auth/EmbeddedSignIn"
import { requestCheckoutFinalizeApi } from "@/components/front/courses/enroll/effects/checkout-api"
import { useNewStudentVerification } from "./hooks/useNewStudentVerification"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { getPhotoPolicy } from "@/lib/checkin/photo-context-policy"
import { handleEmbeddedSignInSessionCreated, notifyPaymentsStepReadyForOpenSession, shouldFetchConsecutiveOffer, shouldIncludePhotoStep } from "@/lib/checkin/enroll-flow"
import { createEmptyKioskQrCheckoutState, getKioskPaymentTransitionRemainingMs, isKioskCardFastPathEligible, isKioskInfoFastPathEligible, isKioskQrPendingPhase, shouldAutoAdvanceKioskInfoStep, shouldMaskKioskInfoStep } from "@/lib/checkin/kiosk-qr-payment"
import { createInitialEnrollFlowState, enrollFlowReducer } from "@/components/front/courses/enroll/model/enroll-flow.reducer"
import { useConsecutiveOffer } from "@/components/front/courses/enroll/hooks/useConsecutiveOffer"
import { useEnrollInit } from "@/components/front/courses/enroll/hooks/useEnrollInit"
import { useKioskInactivity } from "@/components/front/courses/enroll/hooks/useKioskInactivity"
import { useKioskQrPoller } from "@/components/front/courses/enroll/hooks/useKioskQrPoller"
import type { EnrollModalProps, FlowPopupState, PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"
import EnrollSidebar from "@/components/front/courses/enroll/steps/EnrollSidebar"
import EnrollSignInOverlay from "@/components/front/courses/enroll/steps/EnrollSignInOverlay"
import EnrollFlowPopup from "@/components/front/courses/enroll/steps/EnrollFlowPopup"
import EnrollStepRouter from "@/components/front/courses/enroll/steps/EnrollStepRouter"
import EnrollSuccessView from "@/components/front/courses/enroll/steps/EnrollSuccessView"
import EnrollFormFooter from "@/components/front/courses/enroll/steps/EnrollFormFooter"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"
import { resolveStepValid } from "@/components/front/courses/enroll/model/enroll-step-valid"
import type { KioskInfoPhase } from "@/components/front/courses/enroll/model/kiosk-info-phase"
import { useEnrollFlowSetters } from "@/components/front/courses/enroll/hooks/useEnrollFlowSetters"
import { useEnrollDerivedState } from "@/components/front/courses/enroll/hooks/useEnrollDerivedState"
import { useEnrollEffects } from "@/components/front/courses/enroll/hooks/useEnrollEffects"
import { useEnrollActions } from "@/components/front/courses/enroll/hooks/useEnrollActions"

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/

const normalizeIsoDate = (v: unknown) => (typeof v === "string" && ISO_DATE_REGEX.test(v.trim()) ? v.trim() : "")
const normalizeTime24 = (v: unknown) => (typeof v === "string" && TIME_24_REGEX.test(v.trim()) ? v.trim() : "")
const normalizeDurationMinutes = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(15, Math.min(240, Math.round(n))) : 60 }
const pad = (n: number) => String(n).padStart(2, "0")
const toMinutes = (t: string) => { if (!TIME_24_REGEX.test(t)) return null; const [h, m] = t.split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null }
const to12hLabel = (t: string) => { const m = toMinutes(t); if (m === null) return t; const h24 = Math.floor(m / 60), min = m % 60, ampm = h24 >= 12 ? "PM" : "AM", h12 = h24 % 12 || 12; return `${h12}:${pad(min)} ${ampm}` }

export const formatCheckInSummaryDateTime = formatCheckInSummaryDateTimeModel
export const computeCheckInAutofill = computeCheckInAutofillModel

export default function EnrollModal({
  course, open, onCloseAction, onCompletedAction, onPaymentsStepReadyAction, onTimeoutAction,
  onExistingUserDetected, onKioskSessionCreated, initialStep, mode = "modal", prefillContact,
  prefillHasAvatar, prefillSelection, flowVariant = "default", compactBookingSource,
  completionMode = "default", photoFlowContext = "external_web", checkInContext,
  kioskSessionToken, useDraft = true, preventOutsideClose = false, skipContactStep = false,
  consecutiveOffer, isPackageHolder = false,
}: EnrollModalProps) {
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(() => (catalogCourses.length ? catalogCourses : demoCourses), [catalogCourses])
  const { t } = useI18n()
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const { setActive } = useClerk()
  const pendingClerkSessionRef = React.useRef<string | null>(null)
  const verification = useNewStudentVerification()
  const { state: verificationState, verify: verifyNewStudent, reset: resetVerification, onSmsVerified: markSmsVerified } = verification
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
  const initialContact = React.useMemo<EnrollmentContact>(() => ({ firstName: "", lastName: "", email: "", phone: "+1 ", note: "" }), [])
  const [flowState, dispatchFlow] = React.useReducer(enrollFlowReducer, createInitialEnrollFlowState({ contact: initialContact, maxStep: 0, service: "" }))
  const { service, pkg, addons, participants, contact, step, success, successMessage, processing, formError, requiresSignIn, existingAccountDetected, resumeAfterSignInStep, resumeContactFlowAfterSignIn, kioskQrCheckout, signInPurpose, paymentMethod } = flowState

  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [couponInput, setCouponInput] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<Coupon>(null)
  const [activeNumericField, setActiveNumericField] = React.useState<"phone" | null>(() => isKioskTerminalFlow ? "phone" : null)
  const [kioskInfoPhase, setKioskInfoPhase] = React.useState<KioskInfoPhase>(() => isKioskTerminalFlow ? "phone" : "name-email")
  const [timeLoading, setTimeLoading] = React.useState(false)
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [pendingAutoPay, setPendingAutoPay] = React.useState(false)
  const [identityCheckBusy, setIdentityCheckBusy] = React.useState(false)
  const [phoneTouched, setPhoneTouched] = React.useState(false)
  const [stripeClientSecret, setStripeClientSecret] = React.useState("")
  const [showStripeModal, setShowStripeModal] = React.useState(false)
  const [preparedAccount, setPreparedAccount] = React.useState<PreparedAccountState | null>(null)
  const [photoSaved, setPhotoSaved] = React.useState(false)
  const [consecutiveAccepted, setConsecutiveAccepted] = React.useState(false)
  const [consecutiveAddedCents, setConsecutiveAddedCents] = React.useState(0)
  const [consecutiveChoiceMade, setConsecutiveChoiceMade] = React.useState(false)
  const [newStudentFallbackPhoneKey, setNewStudentFallbackPhoneKey] = React.useState<string | null>(null)
  const [flowPopup, setFlowPopup] = React.useState<FlowPopupState | null>(null)
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
  const effectiveIsPackageHolder = isPackageHolder || Boolean(pkg)
  const resetConsecutiveChoice = React.useCallback(() => setConsecutiveChoiceMade(false), [])
  const resetConsecutiveAccepted = React.useCallback(() => setConsecutiveAccepted(false), [])
  const resetConsecutiveAddedCents = React.useCallback(() => setConsecutiveAddedCents(0), [])
  const { fetchedOffer: fetchedConsecutiveOffer, offerLoading: consecutiveOfferLoading } = useConsecutiveOffer({
    courseSlug: course.slug, date, time, consecutiveOffer,
    enabled: shouldFetchConsecutiveOffer({ isQrMobileCompactFlow, isCheckInFlow, isProfileBookingFlow }),
    resetChoice: resetConsecutiveChoice, resetAccepted: resetConsecutiveAccepted, resetAddedCents: resetConsecutiveAddedCents,
  })
  const effectiveConsecutiveOffer = consecutiveOffer ?? fetchedConsecutiveOffer
  const accountHasAvatar = Boolean(prefillHasAvatar || preparedAccount?.hasAvatar || photoSaved)
  const requiresPhotoStep = React.useMemo(() => shouldIncludePhotoStep({ isCheckInFlow, photoPolicyRequired: photoPolicy.photoRequired, hasAvatar: accountHasAvatar, photoSaved }), [accountHasAvatar, isCheckInFlow, photoPolicy.photoRequired, photoSaved])

  const derived = useEnrollDerivedState({ course, sourceCourses, isCheckInFlow, isCheckInNewFlow, isCheckInExistingFlow, isKioskTerminalFlow, isQrMobileCompactFlow, isProfileBookingFlow, skipContactStep, initialStep, newStudentFallbackPhoneKey, contact, service, pkg, addons, participants, date, time, appliedCoupon, consecutiveAccepted, consecutiveAddedCents, effectiveConsecutiveOffer, requiresPhotoStep, photoSaved, consecutiveChoiceMade, consecutiveOfferLoading, paymentMethod, checkInNow, user })
  const { availableServices, hasNewStudentService, courseAvailableWeekdays, regularServiceId, stepKeys, steps, paymentsStepIndex, infoStepIndex, photoStepIndex, packagesStepIndex, regularServicePrice, regularFallbackLocked, effectiveInitialStep, signInModalVariant, kioskPaymentTransitionMessage, currentUserContact, pricing, calendarLinks, visibleTimeSlots, isSlotExpiredForCheckIn, formattedSummaryDateTime, stepValidCtx, getCurrentCourseTimesForDate } = derived
  const { total, subtotal, discount, serviceOpt, packageOpt: pkgOpt, addonOptions: addonsOpts } = pricing
  const { eventDates, googleCalHref, icsDataUri } = calendarLinks

  const flowSetters = useEnrollFlowSetters(dispatchFlow as React.Dispatch<{ type: string; [key: string]: unknown }>, steps.length)
  const { setService, setPkg, setAddons, setParticipants, setContact, setPaymentMethod, setStep, setSuccess, setSuccessMessage, setProcessing, setFormError, setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setKioskQrCheckout, setSignInPurpose } = flowSetters

  const forcedNewStudentServiceId = hasNewStudentService ? "new-student" : (availableServices[0]?.id ?? "")
  const initialServiceId = React.useMemo(() => { if (isCheckInNewFlow) return forcedNewStudentServiceId; if (isCheckInExistingFlow) return regularServiceId; return availableServices[0]?.id ?? "" }, [availableServices, forcedNewStudentServiceId, isCheckInExistingFlow, isCheckInNewFlow, regularServiceId])
  const draftKey = React.useMemo(() => `pli-enroll:${course.slug}`, [course.slug])
  const signInReturnTo = `/courses/${course.slug}?enroll=1&step=${Math.max(0, Math.min(steps.length - 1, step))}`
  const handleSubmitRef = React.useRef<(e?: React.FormEvent) => Promise<void>>(async () => {})
  const advanceFromContactStepRef = React.useRef<() => Promise<void>>(async () => {})
  const activeStepKey = steps[step]?.key || ""

  useEnrollInit({ open, prefillContact, prefillSelection, userContact: currentUserContact, setKioskStepHydrating, course, sourceCourses, availableServices, draftKey, useDraft, initialServiceId, isCheckInNewFlow, isCheckInFlow, isCheckInExistingFlow, isKioskTerminalFlow, isQrMobileCompactFlow, checkInContextDate, checkInContextTime, effectiveInitialStep, kioskFastPathAdvanceTriggeredRef, kioskFastPathSubmitTriggeredRef, setService, setPkg, setAddons, setParticipants, setDate, setTime, setContact, setCouponInput, setAppliedCoupon, setPaymentMethod, setStep, setCheckInScheduleNotice, setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setPendingAutoPay, setIdentityCheckBusy, setPhoneTouched, setStripeClientSecret, setShowStripeModal, setKioskQrCheckout, setFormError })
  useEnrollDraft({ open: useDraft ? open : false, success, draftKey, stepsCount: steps.length, state: { service, pkg, addons, participants, date, time, contact, couponInput, appliedCoupon, paymentMethod, step }, setters: { setService, setPkg, setAddons, setParticipants, setDate, setTime, setContact, setCouponInput, setAppliedCoupon, setPaymentMethod, setStep } })
  useKioskInactivity({ open, isStationCompletion, success, qrPhase: kioskQrCheckout.phase, onCompletedAction, onTimeoutAction })

  const actions = useEnrollActions({ course, availableServices, service, pkg, addons, participants, date, time, contact, appliedCoupon, paymentMethod, total, photoFlowContext, kioskSessionToken, checkInContextDate, checkInContextTime, checkInContextDuration, consecutiveAccepted, consecutiveAddedCents, effectiveConsecutiveOffer, isCheckInFlow, isKioskTerminalFlow, isQrMobileCompactFlow, isSignedIn, processing, identityCheckBusy, requiresSignIn, formError, step, steps, photoPolicy, photoSaved, photoStepIndex, packagesStepIndex, paymentsStepIndex, infoStepIndex, skipContactStep, regularServiceId, regularServicePrice, usesPhasedInfoForm, activeStepKey: activeStepKey as "" | "party" | "datetime" | "info" | "photo" | "packages" | "consecutive" | "payments" | "review", kioskInfoPhase, activeNumericField, preparedAccount, pendingAutoPay, signInPurpose, onCloseAction, onExistingUserDetected, onKioskSessionCreated, kioskQrCheckout, showKioskPaymentTransition, kioskPaymentTransitionTimeoutRef, kioskPaymentTransitionStartedAtRef, stationCompletionTimeoutRef, kioskFastPathAdvanceTriggeredRef, kioskFastPathSubmitTriggeredRef, getToken, verifyNewStudent, markSmsVerified, resetVerification, verification, setService, setAddons, setParticipants, setDate, setTime, setContact, setStep, setSuccess, setSuccessMessage, setProcessing, setFormError, setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setPendingAutoPay, setKioskQrCheckout, setSignInPurpose, setIdentityCheckBusy, setPhoneTouched, setStripeClientSecret, setShowStripeModal, setCheckInScheduleNotice, setActiveNumericField, setKioskInfoPhase, setPreparedAccount, setPhotoSaved, setNewStudentFallbackPhoneKey, setFlowPopup, setConsecutiveAccepted, setConsecutiveAddedCents, setConsecutiveChoiceMade, setShowKioskPaymentTransition, t: t as (key: string, params?: Record<string, unknown>) => string })
  const { handleSubmit, handleClose, handleFormStepSubmit, handleSignInDismiss, handleNumpadDigit, handleNumpadBackspace, handleNumpadClear, advanceFromContactStep, completeDropInCheckInAfterCardPayment, resetKioskQrCheckout, resetForm, formatPackageMeta } = actions
  handleSubmitRef.current = handleSubmit
  advanceFromContactStepRef.current = advanceFromContactStep

  useEnrollEffects({ open, isInline, isCheckInFlow, isCheckInNewFlow, isCheckInExistingFlow, isKioskTerminalFlow, isQrMobileCompactFlow, isNewStudent, isPersonalCompletion, isStationCompletion, success, prefillContact, course, sourceCourses, availableServices, contact, service, participants, date, time, checkInContextDate, checkInContextTime, checkInNow, checkInScheduleNotice, requiresSignIn, existingAccountDetected, resumeAfterSignInStep, resumeContactFlowAfterSignIn, pendingAutoPay, isSignedIn, isLoaded, processing, hasNewStudentService, regularFallbackLocked, regularServiceId, steps, preparedAccount, photoSaved, photoPolicy, photoStepIndex, packagesStepIndex, paymentsStepIndex, user, verificationState, pendingClerkSessionRef, stationCompletionTimeoutRef, kioskPaymentTransitionTimeoutRef, kioskPaymentTransitionStartedAtRef, getToken, router, setActive, onCompletedAction, requestAccountPreparation: actions.requestAccountPreparation, resetVerification, advanceFromContactStepRef, handleSubmitRef, setService, setPkg, setAddons, setParticipants, setDate, setTime, setContact, setStep, setCheckInNow, setCheckInScheduleNotice, setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setPendingAutoPay, setFormError, setPreparedAccount, setPhotoSaved, setShowKioskPaymentTransition, setInitialLoading })

  React.useEffect(() => { if (!open && !isInline) { resetForm(); resetVerification() } }, [open, isInline, resetForm, resetVerification])

  const kioskInfoFastPathEligible = isKioskInfoFastPathEligible({ isKioskTerminalFlow, isCheckInExistingFlow, date, time, contact })
  const kioskCardFastPathEligible = isKioskCardFastPathEligible({ isKioskTerminalFlow, isCheckInExistingFlow, paymentMethod, date, time, contact })
  const kioskInfoTransitionPending = kioskInfoFastPathEligible && !kioskFastPathAdvanceTriggeredRef.current
  const kioskInfoAutoAdvanceReady = shouldAutoAdvanceKioskInfoStep({ isKioskTerminalFlow, isCheckInExistingFlow, date, time, contact, activeStepKey, open, processing, identityCheckBusy, requiresSignIn, hasError: Boolean(formError) })
  const shouldMaskKioskInfoContent = shouldMaskKioskInfoStep({ isKioskTerminalFlow, isCheckInExistingFlow, activeStepKey, open, requiresSignIn, hasError: Boolean(formError), hydrating: kioskStepHydrating, transitionPending: kioskInfoTransitionPending })
  const paymentsReadyFiredRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) { paymentsReadyFiredRef.current = false; return }
    notifyPaymentsStepReadyForOpenSession({ open, hasFired: paymentsReadyFiredRef.current, activeStepKey, showKioskPaymentTransition, markFired: () => { paymentsReadyFiredRef.current = true }, onPaymentsStepReadyAction })
  }, [activeStepKey, onPaymentsStepReadyAction, open, showKioskPaymentTransition])

  React.useEffect(() => {
    if (kioskPaymentTransitionTimeoutRef.current !== null) { window.clearTimeout(kioskPaymentTransitionTimeoutRef.current); kioskPaymentTransitionTimeoutRef.current = null }
    if (!open) { setShowKioskPaymentTransition(false); kioskPaymentTransitionStartedAtRef.current = null; return }
    if (!showKioskPaymentTransition || activeStepKey === "info") return
    const startedAt = kioskPaymentTransitionStartedAtRef.current ?? Date.now()
    const remaining = getKioskPaymentTransitionRemainingMs(startedAt)
    kioskPaymentTransitionTimeoutRef.current = window.setTimeout(() => { setShowKioskPaymentTransition(false); kioskPaymentTransitionStartedAtRef.current = null; kioskPaymentTransitionTimeoutRef.current = null }, remaining)
  }, [activeStepKey, open, showKioskPaymentTransition, setShowKioskPaymentTransition])

  React.useEffect(() => {
    if (!kioskInfoAutoAdvanceReady || kioskFastPathAdvanceTriggeredRef.current) return
    kioskPaymentTransitionStartedAtRef.current = Date.now()
    setShowKioskPaymentTransition(true)
    kioskFastPathAdvanceTriggeredRef.current = true
    void advanceFromContactStepRef.current()
  }, [kioskInfoAutoAdvanceReady, setShowKioskPaymentTransition])

  React.useEffect(() => {
    if (!open || !isKioskTerminalFlow || !kioskCardFastPathEligible) return
    if (!kioskFastPathAdvanceTriggeredRef.current || kioskFastPathSubmitTriggeredRef.current) return
    if (activeStepKey !== "payments" || showKioskPaymentTransition) return
    if (processing || identityCheckBusy || requiresSignIn || kioskQrCheckout.phase !== "idle") return
    kioskFastPathSubmitTriggeredRef.current = true
    void handleSubmitRef.current()
  }, [activeStepKey, identityCheckBusy, isKioskTerminalFlow, kioskCardFastPathEligible, kioskQrCheckout.phase, open, processing, requiresSignIn, showKioskPaymentTransition])

  useKioskQrPoller({ open, isKioskTerminalFlow, sessionId: kioskQrCheckout.sessionId, kioskQrCheckoutPending: isKioskQrPendingPhase(kioskQrCheckout.phase), completeDropInCheckInAfterCardPayment, setSuccessMessage, setSuccess, setRequiresSignIn, setExistingAccountDetected, setResumeAfterSignInStep, setPendingAutoPay, setKioskQrCheckout })

  const canContinue = resolveStepValid(step, stepValidCtx)
  const canContinueCurrentStep = usesPhasedInfoForm && activeStepKey === "info"
    ? kioskInfoPhase === "name-email" ? contact.firstName.trim().length > 1 && contact.email.trim().length > 5 : isCompleteUSPhone(contact.phone)
    : canContinue
  const showAccountExistsSignInCopy = pendingAutoPay || existingAccountDetected
  const signInModalTitle = signInPurpose === "sms_verification" ? "Verify your phone to keep the new-student price" : signInPurpose === "account_preparation" ? "Sign in to continue" : showAccountExistsSignInCopy ? t("account_exists_title") : t("sign_in_modal_title")
  const signInModalSubtitle = signInPurpose === "sms_verification" ? "Complete SMS verification now. If you skip it, the booking will continue with the regular price." : signInPurpose === "account_preparation" ? "Sign in with your phone to upload your profile photo before payment." : showAccountExistsSignInCopy ? t("existing_customer_signin_required") : t("sign_in_modal_subtitle")
  const kioskQrCheckoutPending = isKioskQrPendingPhase(kioskQrCheckout.phase)
  const kioskQrCheckoutLocked = isKioskTerminalFlow && (kioskQrCheckout.phase === "creating" || kioskQrCheckoutPending)
  const hideCalendarSidebar = Boolean((success && isCheckInFlow) || (isKioskTerminalFlow && steps[step]?.key === "payments"))
  const paymentMethodLabel = paymentMethod === "stripe" ? t("payments_stripe") : paymentMethod === "onsite" ? t("payments_onSite") : "—"
  const summaryGridClass = isKioskTerminalFlow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 sm:gap-4"
  const to12h = (v: string) => to12hLabel(v)
  const summaryDateTimeValue = isKioskTerminalFlow ? formattedSummaryDateTime : <>{date || "—"} {to12h(time) || ""}</>

  if (!open && !isInline) return null

  return (
    <div role={isInline ? "region" : "dialog"} aria-modal={isInline ? undefined : true} aria-label={t("aria_dialog_bookingFor", { title: course.title })} className={isInline ? "w-full" : "fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4"}>
      {!isInline && <button aria-label={t("aria_close")} onClick={preventOutsideClose ? undefined : handleClose} className={`absolute inset-0 ${isQrMobileCompactFlow ? "bg-black" : "bg-black/60"} backdrop-blur-sm`} />}
      <GlassyCard data-lenis-prevent className={["relative w-full p-0", forceKioskDarkModal ? "kiosk-terminal-enroll-modal border-white/12 bg-neutral-900/82 text-white shadow-[0_28px_90px_-44px_rgba(0,0,0,0.9)] backdrop-blur-xl" : "bg-white/70 dark:bg-white/10", isInline ? "rounded-3xl overflow-hidden" : ["w-full md:w-[50rem] max-w-[min(50rem,92vw)] mx-auto max-h-[90vh] rounded-2xl", showStripeModal ? "sm:h-auto sm:min-h-[50rem] overflow-hidden" : "overflow-y-auto"].join(" ")].join(" ")}>
        {!isInline && <button type="button" onClick={handleClose} className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 sm:right-3 sm:top-3" aria-label={t("aria_close")}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg></button>}
        <div className={[isInline ? "grid grid-cols-1 md:grid-cols-1" : "grid grid-cols-1 md:grid-cols-12", forceKioskDarkModal ? "dark" : ""].join(" ")}>
          {!hideCalendarSidebar && <EnrollSidebar isInline={isInline} success={success} isQrMobileCompactFlow={isQrMobileCompactFlow} isKioskTerminalFlow={isKioskTerminalFlow} activeStepKey={activeStepKey} step={step} steps={steps} course={course} service={service} pkg={pkg} addons={addons} participants={participants} contact={contact} summaryDateTimeValue={summaryDateTimeValue} summaryGridClass={summaryGridClass} total={total} googleCalHref={googleCalHref} icsDataUri={icsDataUri} eventDates={Boolean(eventDates)} courseSlug={course.slug} date={date} time={time} stepValidCtx={stepValidCtx} onStepClick={setStep} t={t as (key: string) => string} />}
          <section data-kiosk-terminal-panel={forceKioskDarkModal ? "main" : undefined} className={isInline ? "relative p-4 sm:p-6" : hideCalendarSidebar ? "relative md:col-span-12 p-3 sm:p-6" : "relative md:col-span-7 p-3 sm:p-6"}>
            <div className={isInline ? "" : "mx-auto w-full max-w-2xl"}>
              {!(success && isCheckInFlow) && (
                <div className="mb-3 flex items-center gap-2 pr-12">
                  {step > 0 && <button type="button" aria-label={t("back")} onClick={() => setStep((s) => Math.max(0, s - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10">←</button>}
                  <h3 className={`${isInline ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-semibold leading-tight`}>{activeStepKey === "packages" ? course.title : activeStepKey === "consecutive" ? "Promotion for the Second Class" : activeStepKey === "payments" ? "Payment for Salsa Class" : `${steps[step]?.label} • ${course.title}`}</h3>
                </div>
              )}
              {success ? (
                <EnrollSuccessView course={course} date={date} time={time} service={service} contact={contact} successMessage={successMessage} total={total} paymentMethodLabel={paymentMethodLabel} allowPanelAccess={allowPanelAccess} isPersonalCompletion={isPersonalCompletion} isStationCompletion={isStationCompletion} stationCompletionTimeoutRef={stationCompletionTimeoutRef} onCompletedAction={onCompletedAction} handleClose={handleClose} to12h={to12h} t={t as (key: string, params?: Record<string, unknown>) => string} />
              ) : (
                <form onSubmit={async (e) => { e.preventDefault(); await handleFormStepSubmit() }} className="space-y-4">
                  <EnrollStepRouter activeStepKey={activeStepKey} isInline={isInline} isCheckInFlow={isCheckInFlow} isCheckInNewFlow={isCheckInNewFlow} isQrMobileCompactFlow={isQrMobileCompactFlow} isKioskTerminalFlow={isKioskTerminalFlow} isNewStudent={isNewStudent} isCheckInExistingFlow={isCheckInExistingFlow} isProfileBookingFlow={isProfileBookingFlow} skipContactStep={skipContactStep} availableServices={availableServices} hasNewStudentService={hasNewStudentService} course={course} courseAvailableWeekdays={courseAvailableWeekdays} service={service} setService={setService} participants={participants} setParticipants={setParticipants} pkg={pkg} setPkg={setPkg} addons={addons} setAddons={setAddons} contact={contact} setContact={setContact} date={date} setDate={setDate} time={time} setTime={setTime} initialLoading={initialLoading} timeLoading={timeLoading} setTimeLoading={setTimeLoading} checkInScheduleNotice={checkInScheduleNotice} setCheckInScheduleNotice={setCheckInScheduleNotice} visibleTimeSlots={visibleTimeSlots} isSlotExpiredForCheckIn={isSlotExpiredForCheckIn} to12h={to12h} getCurrentCourseTimesForDate={getCurrentCourseTimesForDate} photoPolicy={photoPolicy} preparedAccount={preparedAccount} setPreparedAccount={setPreparedAccount} setPhotoSaved={setPhotoSaved} setFormError={setFormError} requiresPhotoStep={requiresPhotoStep} step={step} steps={steps} stepKeys={stepKeys} setStep={setStep} photoStepIndex={photoStepIndex} effectiveConsecutiveOffer={effectiveConsecutiveOffer} effectiveIsPackageHolder={effectiveIsPackageHolder} consecutiveAccepted={consecutiveAccepted} setConsecutiveAccepted={setConsecutiveAccepted} consecutiveChoiceMade={consecutiveChoiceMade} setConsecutiveChoiceMade={setConsecutiveChoiceMade} consecutiveAddedCents={consecutiveAddedCents} setConsecutiveAddedCents={setConsecutiveAddedCents} kioskQrCheckoutLocked={kioskQrCheckoutLocked} couponInput={couponInput} setCouponInput={setCouponInput} appliedCoupon={appliedCoupon} setAppliedCoupon={setAppliedCoupon} subtotal={subtotal} total={total} serviceOpt={serviceOpt} pkgOpt={pkgOpt} addonsOpts={addonsOpts} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paymentMethodLabel={paymentMethodLabel} formatPackageMeta={formatPackageMeta} activeNumericField={activeNumericField} handleNumpadBackspace={handleNumpadBackspace} handleNumpadClear={handleNumpadClear} handleNumpadDigit={handleNumpadDigit} kioskInfoPhase={kioskInfoPhase} phoneTouched={phoneTouched} setActiveNumericField={setActiveNumericField} setExistingAccountDetected={setExistingAccountDetected} setPendingAutoPay={setPendingAutoPay} setPhoneTouched={setPhoneTouched} setRequiresSignIn={setRequiresSignIn} setResumeAfterSignInStep={setResumeAfterSignInStep} setKioskInfoPhase={setKioskInfoPhase} shouldMaskKioskInfoContent={shouldMaskKioskInfoContent} usesPhasedInfoForm={usesPhasedInfoForm} t={t} />
                  <EnrollFormFooter step={step} steps={steps} activeStepKey={activeStepKey} isInline={isInline} allowPanelAccess={allowPanelAccess} usesPhasedInfoForm={usesPhasedInfoForm} kioskInfoPhase={kioskInfoPhase} kioskQrCheckoutLocked={kioskQrCheckoutLocked} kioskQrCheckout={kioskQrCheckout} isKioskTerminalFlow={isKioskTerminalFlow} paymentMethod={paymentMethod} processing={processing} identityCheckBusy={identityCheckBusy} consecutiveOfferLoading={consecutiveOfferLoading} canContinueCurrentStep={canContinueCurrentStep} handleClose={handleClose} handleSubmit={handleSubmit} resetKioskQrCheckout={resetKioskQrCheckout} setStep={setStep} setKioskInfoPhase={setKioskInfoPhase} setActiveNumericField={setActiveNumericField} t={t as (key: string, params?: Record<string, unknown>) => string} />
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
          <StripePaymentModal clientSecret={stripeClientSecret} onClose={() => setShowStripeModal(false)} onSuccess={async (paymentIntentId?: string) => {
            let completionMessage: string | null = null, purchaseFinalized = false
            if (paymentIntentId) {
              try {
                const token = isSignedIn ? await getToken({ skipCache: true }) : null
                const { res: finalizeRes } = await requestCheckoutFinalizeApi({ token, paymentIntentId })
                purchaseFinalized = finalizeRes.ok
                if (finalizeRes.ok) completionMessage = await completeDropInCheckInAfterCardPayment({ paymentIntentId })
              } catch (error) { console.warn("Unable to finalize purchase sync", error); completionMessage = isCheckInFlow ? "Payment was completed, but we couldn't confirm automatic check-in." : null }
            }
            if (isCheckInFlow && !completionMessage) completionMessage = purchaseFinalized ? "Purchase recorded successfully." : "Payment was completed, but check-in sync is still pending."
            setSuccessMessage(completionMessage)
            setSuccess(true)
          }} email={contact.email} name={`${contact.firstName} ${contact.lastName}`.trim()} phone={contact.phone} />
        )}
        {isKioskTerminalFlow && paymentMethod === "stripe" && kioskQrCheckout.phase !== "idle" && <KioskQrPaymentPanel checkoutState={kioskQrCheckout} onCancel={resetKioskQrCheckout} onRetry={() => { kioskFastPathSubmitTriggeredRef.current = true; setFormError(null); void handleSubmit() }} />}
      </GlassyCard>
      {flowPopup && <EnrollFlowPopup title={flowPopup.title} message={flowPopup.message} onContinue={() => { setFlowPopup(null); void advanceFromContactStepRef.current() }} />}
      {(verificationState === "sms_pending" || verificationState === "sms_verifying") && (isKioskTerminalFlow || isQrMobileCompactFlow) && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <button type="button" aria-label={t("aria_close")} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { resetVerification() }} />
          <div className="relative z-10 w-full max-w-[22rem] rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.18),transparent_52%),linear-gradient(160deg,rgba(12,15,28,0.98),rgba(21,25,40,0.96))] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)] sm:p-5">
            <button type="button" className="absolute right-5 top-5 z-10 shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/75 transition hover:bg-white/[0.04]" onClick={() => { resetVerification() }}>{t("cancel")}</button>
            <EmbeddedSignIn redirectUrl={signInReturnTo} phoneNumber={toE164Phone(contact.phone)} useNumericKeypad={isKioskTerminalFlow} activateSessionOnSuccess={false} bare onCodeSent={() => { verification.onSmsSent() }} onSessionCreated={(sessionId) => { pendingClerkSessionRef.current = sessionId; handleEmbeddedSignInSessionCreated({ onKioskSessionCreated, sessionId }) }} onSuccessAction={async () => { markSmsVerified() }} />
          </div>
        </div>
      )}
      {requiresSignIn && <EnrollSignInOverlay title={signInModalTitle} subtitle={signInModalSubtitle} variant={signInModalVariant as "compact" | "sheet"} signInReturnTo={signInReturnTo} phoneE164={toE164Phone(contact.phone) ?? ""} isKioskTerminalFlow={isKioskTerminalFlow} isCheckInFlow={isCheckInFlow} onDismiss={handleSignInDismiss} onSuccessAction={async () => { setFormError(null) }} cancelLabel={t("cancel")} backLabel={t("account_exists_back")} />}
    </div>
  )
}
