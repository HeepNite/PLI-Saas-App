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

export function useEnrollEffects(input: UseEnrollEffectsInput) {
  const {
    open, isInline, isCheckInFlow, isCheckInNewFlow, isCheckInExistingFlow, isKioskTerminalFlow,
    isQrMobileCompactFlow, isNewStudent, isPersonalCompletion, isStationCompletion, success,
    prefillContact, course, sourceCourses, availableServices, contact, service, participants,
    date, time, checkInContextDate, checkInContextTime, checkInNow, checkInScheduleNotice,
    requiresSignIn, existingAccountDetected, resumeAfterSignInStep, resumeContactFlowAfterSignIn,
    pendingAutoPay, isSignedIn, isLoaded, processing, hasNewStudentService, regularFallbackLocked,
    regularServiceId, steps, preparedAccount, photoSaved, photoPolicy, photoStepIndex,
    packagesStepIndex, paymentsStepIndex, user, verificationState, pendingClerkSessionRef,
    stationCompletionTimeoutRef, kioskPaymentTransitionTimeoutRef, kioskPaymentTransitionStartedAtRef,
    getToken, router, setActive, onCompletedAction, requestAccountPreparation, resetVerification,
    advanceFromContactStepRef, handleSubmitRef,
    setService, setPkg, setAddons, setParticipants, setDate, setTime, setContact, setStep,
    setCheckInNow, setCheckInScheduleNotice, setRequiresSignIn, setExistingAccountDetected,
    setResumeAfterSignInStep, setResumeContactFlowAfterSignIn, setPendingAutoPay, setFormError,
    setPreparedAccount, setPhotoSaved, setShowKioskPaymentTransition, setInitialLoading,
  } = input

  // Initial loading delay
  React.useEffect(() => {
    const id = window.setTimeout(() => setInitialLoading(false), 400)
    return () => window.clearTimeout(id)
  }, [setInitialLoading])

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

  // Check-in clock
  React.useEffect(() => {
    if (!isCheckInFlow || !open) return
    setCheckInNow(new Date())
    const intervalId = window.setInterval(() => setCheckInNow(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [isCheckInFlow, open, setCheckInNow])

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
  }, [stationCompletionTimeoutRef, kioskPaymentTransitionTimeoutRef])

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
  }, [isStationCompletion, onCompletedAction, success, stationCompletionTimeoutRef])

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
  }, [isPersonalCompletion, router, setActive, success, pendingClerkSessionRef])

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
    setPreparedAccount,
    setPhotoSaved,
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
  }, [
    isCheckInFlow, open, course.slug, checkInContextDate, checkInContextTime, checkInNow,
    date, time, checkInScheduleNotice, sourceCourses, isKioskTerminalFlow, isQrMobileCompactFlow,
    setDate, setTime, setCheckInScheduleNotice,
  ])

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
  }, [pendingAutoPay, isSignedIn, processing, getToken, setRequiresSignIn, setPendingAutoPay, handleSubmitRef])

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
    advanceFromContactStepRef,
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
    requestAccountPreparation, photoPolicy, photoSaved, photoStepIndex, packagesStepIndex,
    paymentsStepIndex, resetVerification, setStep,
  ])
}
