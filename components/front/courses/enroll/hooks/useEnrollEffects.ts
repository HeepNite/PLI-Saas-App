"use client"
import React from "react"
import type { EnrollmentOption } from "@/constants/courses"
import type { EnrollmentContact } from "@/components/front/courses/types"
import { computeCheckInAutofill } from "@/components/front/courses/enroll/model/checkin-autofill"
import { formatUSPhone, hasPhoneDigits } from "@/components/front/courses/utils/phone"
import { shouldRedirectPersonalCompletion } from "@/lib/checkin/enroll-flow"
import { resolveCheckInServiceSelection } from "@/lib/checkin/new-student-flow"
import { isPhotoRequiredForAccount } from "@/lib/checkin/photo-context-policy"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import type { CourseData } from "@/constants/courses"
import type { PreparedAccountState } from "@/components/front/courses/enroll/types/enroll-modal-props"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type UseEnrollEffectsInput = {
  open: boolean
  isInline: boolean
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isCheckInExistingFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow: boolean
  isNewStudent: boolean
  isPersonalCompletion: boolean
  isStationCompletion: boolean
  success: boolean
  prefillContact?: Partial<EnrollmentContact>
  course: { slug: string; enrollment: { packages: { id: string }[]; addons?: { id: string }[]; services: { id: string }[] } }
  sourceCourses: CourseData[]
  availableServices: EnrollmentOption[]
  contact: EnrollmentContact
  service: string
  participants: number
  date: string
  time: string
  checkInContextDate: string
  checkInContextTime: string
  checkInNow: Date
  checkInScheduleNotice: string | null
  requiresSignIn: boolean
  existingAccountDetected: boolean
  resumeAfterSignInStep: number | null
  resumeContactFlowAfterSignIn: boolean
  pendingAutoPay: boolean
  isSignedIn: boolean | undefined
  isLoaded: boolean | undefined
  processing: boolean
  hasNewStudentService: boolean
  regularFallbackLocked: boolean
  regularServiceId: string
  steps: Array<{ key: string; label: string }>
  preparedAccount: PreparedAccountState | null
  photoSaved: boolean
  photoPolicy: PhotoPolicy
  photoStepIndex: number
  promoStepIndex: number
  packagesStepIndex: number
  paymentsStepIndex: number
  user?: {
    firstName?: string | null
    lastName?: string | null
    primaryPhoneNumber?: { phoneNumber: string } | null
    phoneNumbers?: Array<{ phoneNumber: string }>
    primaryEmailAddress?: { emailAddress: string } | null
  } | null
  verificationState: string
  pendingClerkSessionRef: React.MutableRefObject<string | null>
  stationCompletionTimeoutRef: React.MutableRefObject<number | null>
  kioskPaymentTransitionTimeoutRef: React.MutableRefObject<number | null>
  kioskPaymentTransitionStartedAtRef: React.MutableRefObject<number | null>
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>
  router: { replace: (url: string) => void }
  setActive: (opts: { session: string }) => Promise<void>
  onCompletedAction?: () => void | Promise<void>
  requestAccountPreparation: () => Promise<PreparedAccountState | null>
  resetVerification: () => void
  advanceFromContactStepRef: React.MutableRefObject<() => Promise<void>>
  handleSubmitRef: React.MutableRefObject<(e?: React.FormEvent) => Promise<void>>
  setService: SetState<string>
  setPkg: SetState<string>
  setAddons: SetState<string[]>
  setParticipants: SetState<number>
  setDate: SetState<string>
  setTime: SetState<string>
  setContact: SetState<EnrollmentContact>
  setStep: SetState<number>
  setCheckInNow: SetState<Date>
  setCheckInScheduleNotice: SetState<string | null>
  setRequiresSignIn: SetState<boolean>
  setExistingAccountDetected: SetState<boolean>
  setResumeAfterSignInStep: SetState<number | null>
  setResumeContactFlowAfterSignIn: SetState<boolean>
  setPendingAutoPay: SetState<boolean>
  setFormError: SetState<string | null>
  setPreparedAccount: SetState<PreparedAccountState | null>
  setPhotoSaved: SetState<boolean>
  setShowKioskPaymentTransition: SetState<boolean>
  setInitialLoading: SetState<boolean>
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeEnrollPhonePrefill(value?: string): string {
  if (typeof value !== "string" || value.trim().length === 0) return "+1 "
  return formatUSPhone(value)
}

/**
 * Pre-init cluster: the single effect that today fires BEFORE `useEnrollInit`
 * / `useEnrollDraft` in EnrollModal (check-in-clock, live line ~357). Kept as
 * its own call so its position relative to those two hooks never changes.
 */
export function useEnrollEffectsPreInit(
  input: Pick<UseEnrollEffectsInput, "isCheckInFlow" | "open" | "setCheckInNow">
) {
  const { isCheckInFlow, open, setCheckInNow } = input

  // Check-in clock
  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    setCheckInNow(new Date())
    const intervalId = window.setInterval(() => setCheckInNow(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [isCheckInFlow, open])
}

/**
 * Early cluster: the effects that today fire AFTER `useEnrollInit` /
 * `useEnrollDraft` but BEFORE `useKioskInactivity` (live lines ~481-539).
 */
export function useEnrollEffectsEarly(
  input: Pick<
    UseEnrollEffectsInput,
    | "isCheckInNewFlow"
    | "open"
    | "prefillContact"
    | "setContact"
    | "setInitialLoading"
    | "stationCompletionTimeoutRef"
    | "kioskPaymentTransitionTimeoutRef"
    | "success"
    | "isStationCompletion"
    | "onCompletedAction"
    | "isPersonalCompletion"
    | "router"
    | "setActive"
    | "pendingClerkSessionRef"
  >
) {
  const {
    isCheckInNewFlow, open, prefillContact, setContact, setInitialLoading,
    stationCompletionTimeoutRef, kioskPaymentTransitionTimeoutRef,
    success, isStationCompletion, onCompletedAction,
    isPersonalCompletion, router, setActive, pendingClerkSessionRef,
  } = input

  // Prefill contact (non-check-in flows)
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

  // Initial loading delay
  React.useEffect(() => {
    const id = window.setTimeout(() => setInitialLoading(false), 400)
    return () => window.clearTimeout(id)
  }, [])

  // Cleanup timeouts on unmount
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

  // Station completion auto-close timer
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

  // Personal completion redirect
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
}

/**
 * Mid cluster: the effects that today fire AFTER `useKioskInactivity` but
 * BEFORE the `formatPackageMeta` `useCallback` (live lines ~550-579).
 */
export function useEnrollEffectsMid(
  input: Pick<
    UseEnrollEffectsInput,
    | "isInline"
    | "open"
    | "availableServices"
    | "setService"
    | "isCheckInNewFlow"
    | "hasNewStudentService"
    | "regularFallbackLocked"
    | "course"
    | "setPkg"
    | "setAddons"
    | "isNewStudent"
    | "participants"
    | "setParticipants"
    | "isCheckInFlow"
    | "contact"
    | "service"
    | "setPreparedAccount"
    | "setPhotoSaved"
    | "isLoaded"
    | "isSignedIn"
    | "user"
    | "setContact"
  >
) {
  const {
    isInline, open,
    availableServices, setService, isCheckInNewFlow, hasNewStudentService, regularFallbackLocked,
    course, setPkg, setAddons,
    isNewStudent, participants, setParticipants,
    isCheckInFlow, contact, service, setPreparedAccount, setPhotoSaved,
    isLoaded, isSignedIn, user, setContact,
  } = input

  // Body scroll lock when modal is open
  React.useEffect(() => {
    if (isInline) return
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isInline])

  // Service / package / addon reset when course changes
  React.useEffect(() => {
    const serviceIds = availableServices.map((s) => s.id)
    setService((prev) =>
      resolveCheckInServiceSelection({
        previousService: prev,
        availableServiceIds: serviceIds,
        isCheckInNewFlow,
        hasNewStudentService,
        regularFallbackLocked,
      })
    )
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

  // Force participants=1 for new-student
  React.useEffect(() => {
    if (isNewStudent && participants !== 1) {
      setParticipants(1)
    }
  }, [isNewStudent, participants, setParticipants])

  // Reset prepared account when contact changes
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

  // Force new-student service for checkin-new
  React.useEffect(() => {
    if (!isCheckInNewFlow || !open || !hasNewStudentService) return
    if (regularFallbackLocked) return
    if (service !== "new-student") {
      setService("new-student")
    }
  }, [hasNewStudentService, isCheckInNewFlow, open, regularFallbackLocked, service, setService])

  // Prefill contact from signed-in user (non-check-in-new flows)
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
}

/**
 * Check-in autofill date/time: today fires AFTER the `formatPackageMeta`
 * `useCallback` (live lines ~577-609), still before `useEnrollPaymentActions`.
 * Kept as its own call so this effect's position relative to that
 * `useCallback` never changes.
 */
export function useEnrollEffectsCheckInAutofill(
  input: Pick<
    UseEnrollEffectsInput,
    | "isCheckInFlow"
    | "open"
    | "course"
    | "sourceCourses"
    | "checkInContextDate"
    | "checkInContextTime"
    | "checkInNow"
    | "date"
    | "time"
    | "checkInScheduleNotice"
    | "isKioskTerminalFlow"
    | "isQrMobileCompactFlow"
    | "setDate"
    | "setTime"
    | "setCheckInScheduleNotice"
  >
) {
  const {
    isCheckInFlow, open, course, sourceCourses, checkInContextDate, checkInContextTime, checkInNow,
    date, time, checkInScheduleNotice, isKioskTerminalFlow, isQrMobileCompactFlow, setDate, setTime,
    setCheckInScheduleNotice,
  } = input

  // Check-in autofill date/time
  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    const recommended = computeCheckInAutofill(
      course.slug,
      sourceCourses,
      { date: checkInContextDate, time: checkInContextTime },
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
    // NOTE: `isKioskTerminalFlow`/`isQrMobileCompactFlow` are read above (in the
    // `computeCheckInAutofill` call) but intentionally NOT added to this deps
    // array, matching live EnrollModal's exact (pre-existing, buggy)
    // `react-hooks/exhaustive-deps` array so this wiring slice introduces zero
    // behavior change. This is a known, previously-documented correctness gap in
    // live code — fixing it is out of scope for a behavior-preserving wiring slice.
  }, [
    isCheckInFlow, open, course.slug, checkInContextDate, checkInContextTime, checkInNow,
    date, time, checkInScheduleNotice, sourceCourses,
  ])
}

/**
 * Late cluster: the effects that need `handleSubmitRef` / `advanceFromContactStepRef`
 * / `requestAccountPreparation`, only available after those refs/callbacks are
 * constructed in EnrollModal (today at live lines ~895-989, right after the
 * `handleSubmitRef`/`advanceFromContactStepRef` refs are assigned).
 */
export function useEnrollEffectsLate(
  input: Pick<
    UseEnrollEffectsInput,
    | "pendingAutoPay"
    | "isSignedIn"
    | "processing"
    | "getToken"
    | "setRequiresSignIn"
    | "setPendingAutoPay"
    | "handleSubmitRef"
    | "requiresSignIn"
    | "existingAccountDetected"
    | "resumeAfterSignInStep"
    | "service"
    | "regularServiceId"
    | "isQrMobileCompactFlow"
    | "setService"
    | "steps"
    | "setStep"
    | "setResumeAfterSignInStep"
    | "setFormError"
    | "resumeContactFlowAfterSignIn"
    | "setExistingAccountDetected"
    | "setResumeContactFlowAfterSignIn"
    | "advanceFromContactStepRef"
    | "open"
    | "verificationState"
    | "isKioskTerminalFlow"
    | "preparedAccount"
    | "requestAccountPreparation"
    | "photoPolicy"
    | "photoSaved"
    | "photoStepIndex"
    | "promoStepIndex"
    | "packagesStepIndex"
    | "paymentsStepIndex"
    | "resetVerification"
  >
) {
  const {
    pendingAutoPay, isSignedIn, processing, getToken, setRequiresSignIn, setPendingAutoPay, handleSubmitRef,
    requiresSignIn, existingAccountDetected, resumeAfterSignInStep, service, regularServiceId,
    isQrMobileCompactFlow, setService, steps, setStep, setResumeAfterSignInStep, setFormError,
    resumeContactFlowAfterSignIn, setExistingAccountDetected, setResumeContactFlowAfterSignIn,
    advanceFromContactStepRef, open, verificationState, isKioskTerminalFlow, preparedAccount,
    requestAccountPreparation, photoPolicy, photoSaved, photoStepIndex, promoStepIndex,
    packagesStepIndex, paymentsStepIndex, resetVerification,
  } = input

  // Auto-pay after sign-in
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

  // Resume flow after sign-in
  React.useEffect(() => {
    if (!isSignedIn) return
    if (requiresSignIn) setRequiresSignIn(false)
    if (existingAccountDetected) setExistingAccountDetected(false)
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
    existingAccountDetected, isQrMobileCompactFlow, isSignedIn, regularServiceId, requiresSignIn,
    resumeContactFlowAfterSignIn, resumeAfterSignInStep,
    setExistingAccountDetected, setFormError, setRequiresSignIn, setResumeAfterSignInStep,
    setResumeContactFlowAfterSignIn, setService, setStep, service, steps.length,
  ])

  // Clamp step when steps array changes
  React.useEffect(() => {
    if (!open) return
    setStep((prev) => Math.max(0, Math.min(prev, steps.length - 1)))
  }, [open, steps.length, setStep])

  // SMS verification → continue to next step (kiosk/QR)
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
  }, [
    verificationState, isKioskTerminalFlow, isQrMobileCompactFlow, preparedAccount,
    requestAccountPreparation, photoPolicy, photoSaved, photoStepIndex, promoStepIndex,
    packagesStepIndex, paymentsStepIndex, resetVerification, setStep,
  ])
}
