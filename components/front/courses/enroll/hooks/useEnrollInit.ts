import React from "react"
import type { CourseData, EnrollmentOption } from "@/constants/courses"
import type { Coupon, CourseEnrollmentData, EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { EnrollPrefillSelection } from "@/components/front/courses/enroll/types/enroll-modal-props"
import { computeCheckInAutofill } from "@/components/front/courses/enroll/model/checkin-autofill"
import { formatUSPhone } from "@/components/front/courses/utils/phone"
import { createEmptyKioskQrCheckoutState, type KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>
type BoolRef = React.MutableRefObject<boolean>

const normalizeEnrollPhonePrefill = (value?: string) => {
  if (typeof value !== "string" || value.trim().length === 0) return "+1 "
  return formatUSPhone(value)
}

type UseEnrollInitInput = {
  open: boolean; prefillContact?: Partial<EnrollmentContact>; prefillSelection?: EnrollPrefillSelection; userContact: Partial<EnrollmentContact>
  course: CourseEnrollmentData; sourceCourses: CourseData[]; availableServices: EnrollmentOption[]; draftKey: string; initialServiceId: string
  useDraft: boolean; isCheckInNewFlow: boolean; isCheckInFlow: boolean; isCheckInExistingFlow: boolean; isKioskTerminalFlow: boolean; isQrMobileCompactFlow: boolean
  checkInContextDate?: string; checkInContextTime?: string; effectiveInitialStep: number; kioskFastPathAdvanceTriggeredRef: BoolRef; kioskFastPathSubmitTriggeredRef: BoolRef
  setService: SetState<string>; setPkg: SetState<string>; setAddons: SetState<string[]>; setParticipants: SetState<number>; setDate: SetState<string>; setTime: SetState<string>
  setContact: SetState<EnrollmentContact>; setCouponInput: SetState<string>; setAppliedCoupon: SetState<Coupon | null>; setPaymentMethod: SetState<PaymentMethod>; setStep: SetState<number>
  setCheckInScheduleNotice: SetState<string | null>; setRequiresSignIn: SetState<boolean>; setExistingAccountDetected: SetState<boolean>; setResumeAfterSignInStep: SetState<number | null>
  setPendingAutoPay: SetState<boolean>; setIdentityCheckBusy: SetState<boolean>; setPhoneTouched: SetState<boolean>; setStripeClientSecret: SetState<string>; setShowStripeModal: SetState<boolean>
  setKioskQrCheckout: SetState<KioskQrCheckoutState>; setFormError: SetState<string | null>; setKioskStepHydrating: SetState<boolean>
}

type UseEnrollInitResult = {
  openInitializationRef: BoolRef
  prefillContactRef: React.MutableRefObject<Partial<EnrollmentContact> | undefined>
  prefillSelectionRef: React.MutableRefObject<EnrollPrefillSelection | undefined>
  userContactRef: React.MutableRefObject<Partial<EnrollmentContact>>
}

export function useEnrollInit(input: UseEnrollInitInput): UseEnrollInitResult {
  const { open, prefillContact, prefillSelection, userContact, setKioskStepHydrating } = input
  const openInitializationRef = React.useRef(false)
  const prefillContactRef = React.useRef(prefillContact)
  const prefillSelectionRef = React.useRef(prefillSelection)
  const userContactRef = React.useRef<Partial<EnrollmentContact>>(userContact)

  React.useEffect(() => {
    prefillContactRef.current = prefillContact
  }, [prefillContact])

  React.useEffect(() => {
    prefillSelectionRef.current = prefillSelection
  }, [prefillSelection])

  React.useEffect(() => {
    userContactRef.current = userContact
  }, [userContact])

  React.useEffect(() => {
    if (open) return
    openInitializationRef.current = false
    setKioskStepHydrating(false)
  }, [open, setKioskStepHydrating])

  React.useEffect(() => {
    if (!input.open || typeof window === "undefined" || openInitializationRef.current) return
    const hasDraft = input.useDraft ? sessionStorage.getItem(input.draftKey) : null
    if (input.useDraft && hasDraft) {
      openInitializationRef.current = true
      input.setKioskStepHydrating(false)
      return
    }
    input.setKioskStepHydrating(input.isKioskTerminalFlow && input.isCheckInExistingFlow)
    if (!input.useDraft) sessionStorage.removeItem(input.draftKey)
    openInitializationRef.current = true

    const userContact = userContactRef.current
    const initialContact: EnrollmentContact = input.isCheckInNewFlow
      ? { firstName: "", lastName: "", email: "", phone: "+1 ", note: "" }
      : {
          firstName: prefillContactRef.current?.firstName ?? userContact.firstName ?? "",
          lastName: prefillContactRef.current?.lastName ?? userContact.lastName ?? "",
          email: prefillContactRef.current?.email ?? userContact.email ?? "",
          phone: normalizeEnrollPhonePrefill(prefillContactRef.current?.phone ?? userContact.phone),
          note: prefillContactRef.current?.note ?? "",
        }
    const shouldAutofillDateTime = input.isCheckInFlow || Boolean(input.checkInContextDate || input.checkInContextTime)
    const todayOnlyAutofill = input.isKioskTerminalFlow || input.isQrMobileCompactFlow
    const checkInAutofill = shouldAutofillDateTime
      ? computeCheckInAutofill(input.course.slug, input.sourceCourses, { date: input.checkInContextDate, time: input.checkInContextTime }, undefined, todayOnlyAutofill)
      : { date: "", time: "", notice: null as string | null }
    const nextService = prefillSelectionRef.current?.service && input.availableServices.some((item) => item.id === prefillSelectionRef.current?.service)
      ? prefillSelectionRef.current.service
      : input.initialServiceId
    const nextPackage = prefillSelectionRef.current?.packageId && input.course.enrollment.packages.some((item) => item.id === prefillSelectionRef.current?.packageId)
      ? prefillSelectionRef.current.packageId
      : ""
    const nextAddons = (prefillSelectionRef.current?.addons || []).filter((id) => input.course.enrollment.addons?.some((item) => item.id === id))
    const nextParticipants = typeof prefillSelectionRef.current?.participants === "number" && Number.isFinite(prefillSelectionRef.current.participants)
      ? Math.max(1, Math.min(10, Math.round(prefillSelectionRef.current.participants)))
      : 1

    input.setService(nextService)
    input.setPkg(nextPackage)
    input.setAddons(nextAddons)
    input.setParticipants(nextParticipants)
    input.setDate(checkInAutofill.date)
    input.setTime(checkInAutofill.time)
    input.setContact(initialContact)
    input.setCouponInput("")
    input.setAppliedCoupon(null)
    input.setPaymentMethod(prefillSelectionRef.current?.paymentMethod || "")
    input.setStep(input.effectiveInitialStep)
    input.setCheckInScheduleNotice(checkInAutofill.notice)
    input.setRequiresSignIn(false)
    input.setExistingAccountDetected(false)
    input.setResumeAfterSignInStep(null)
    input.setPendingAutoPay(false)
    input.setIdentityCheckBusy(false)
    input.setPhoneTouched(false)
    input.setStripeClientSecret("")
    input.setShowStripeModal(false)
    input.setKioskQrCheckout(createEmptyKioskQrCheckoutState())
    input.setFormError(null)
    input.kioskFastPathAdvanceTriggeredRef.current = false
    input.kioskFastPathSubmitTriggeredRef.current = false
    input.setKioskStepHydrating(false)
  }, [input, input.course.enrollment.addons, input.course.enrollment.packages, input.course.slug])

  return { openInitializationRef, prefillContactRef, prefillSelectionRef, userContactRef }
}
