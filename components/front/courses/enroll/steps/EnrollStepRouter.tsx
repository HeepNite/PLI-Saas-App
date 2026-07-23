"use client"
import React from "react"
import { type EnrollmentOption } from "@/constants/courses"
import type { Coupon, EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import EnrollInfoStep from "./EnrollInfoStep"
import type { KioskInfoPhase } from "../model/kiosk-info-phase"
import type { PreparedAccountState } from "../types/enroll-modal-props"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { I18nKey } from "@/lib/i18n-dict"
import StepParty from "./StepParty"
import StepDateTime from "./StepDateTime"
import StepPhoto from "./StepPhoto"
import StepPackages from "./StepPackages"
import StepPromo from "./StepPromo"
import StepConsecutive from "./StepConsecutive"
import StepPayments from "./StepPayments"
import StepReview from "./StepReview"

type ActiveNumericField = "phone" | null

type EnrollStepRouterProps = {
  activeStepKey: string
  isInline: boolean
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isQrMobileCompactFlow: boolean
  isKioskTerminalFlow: boolean
  isNewStudent: boolean
  isCheckInExistingFlow: boolean
  isProfileBookingFlow: boolean
  skipContactStep: boolean
  availableServices: EnrollmentOption[]
  hasNewStudentService: boolean
  course: CourseEnrollmentData
  courseAvailableWeekdays: number[] | undefined
  service: string
  setService: (value: React.SetStateAction<string>) => void
  participants: number
  setParticipants: (value: React.SetStateAction<number>) => void
  pkg: string
  setPkg: (value: React.SetStateAction<string>) => void
  addons: string[]
  setAddons: React.Dispatch<React.SetStateAction<string[]>>
  contact: EnrollmentContact
  setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>>
  date: string
  setDate: React.Dispatch<React.SetStateAction<string>>
  time: string
  setTime: React.Dispatch<React.SetStateAction<string>>
  initialLoading: boolean
  timeLoading: boolean
  setTimeLoading: React.Dispatch<React.SetStateAction<boolean>>
  checkInScheduleNotice: string | null
  setCheckInScheduleNotice: React.Dispatch<React.SetStateAction<string | null>>
  visibleTimeSlots: readonly string[]
  isSlotExpiredForCheckIn: (slot: string) => boolean
  to12h: (value: string) => string
  getCurrentCourseTimesForDate: (dateIso: string) => string[]
  photoPolicy: PhotoPolicy
  preparedAccount: PreparedAccountState | null
  setPreparedAccount: React.Dispatch<React.SetStateAction<PreparedAccountState | null>>
  setPhotoSaved: React.Dispatch<React.SetStateAction<boolean>>
  setFormError: React.Dispatch<React.SetStateAction<string | null>>
  requiresPhotoStep: boolean
  step: number
  steps: { key: string; label: string }[]
  stepKeys: string[]
  setStep: (value: React.SetStateAction<number>) => void
  photoStepIndex: number
  effectiveConsecutiveOffer: ConsecutiveOfferData | null | undefined
  effectiveIsPackageHolder: boolean
  consecutiveAccepted: boolean
  setConsecutiveAccepted: React.Dispatch<React.SetStateAction<boolean>>
  consecutiveChoiceMade: boolean
  setConsecutiveChoiceMade: React.Dispatch<React.SetStateAction<boolean>>
  consecutiveAddedCents: number
  setConsecutiveAddedCents: React.Dispatch<React.SetStateAction<number>>
  kioskQrCheckoutLocked: boolean
  couponInput: string
  setCouponInput: React.Dispatch<React.SetStateAction<string>>
  appliedCoupon: Coupon
  setAppliedCoupon: React.Dispatch<React.SetStateAction<Coupon>>
  subtotal: number
  total: number
  serviceOpt: EnrollmentOption | undefined | null
  pkgOpt: EnrollmentOption | undefined | null
  addonsOpts: EnrollmentOption[]
  paymentMethod: PaymentMethod
  setPaymentMethod: (value: React.SetStateAction<PaymentMethod>) => void
  paymentMethodLabel: string
  formatPackageMeta: (option?: EnrollmentOption | null) => string | undefined
  activeNumericField: ActiveNumericField
  handleNumpadBackspace: () => void
  handleNumpadClear: () => void
  handleNumpadDigit: (digit: string) => void
  kioskInfoPhase: KioskInfoPhase
  phoneTouched: boolean
  setActiveNumericField: React.Dispatch<React.SetStateAction<ActiveNumericField>>
  setExistingAccountDetected: React.Dispatch<React.SetStateAction<boolean>>
  setPendingAutoPay: React.Dispatch<React.SetStateAction<boolean>>
  setPhoneTouched: React.Dispatch<React.SetStateAction<boolean>>
  setRequiresSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setResumeAfterSignInStep: React.Dispatch<React.SetStateAction<number | null>>
  setKioskInfoPhase: React.Dispatch<React.SetStateAction<KioskInfoPhase>>
  shouldMaskKioskInfoContent: boolean
  usesPhasedInfoForm: boolean
  t: (key: I18nKey) => string
}

export default function EnrollStepRouter(props: EnrollStepRouterProps) {
  const { activeStepKey } = props

  return (
    <>
      {activeStepKey === "party" && (
        <StepParty
          isInline={props.isInline}
          isCheckInNewFlow={props.isCheckInNewFlow}
          isNewStudent={props.isNewStudent}
          hasNewStudentService={props.hasNewStudentService}
          availableServices={props.availableServices}
          course={props.course}
          service={props.service}
          setService={props.setService}
          participants={props.participants}
          setParticipants={props.setParticipants}
          pkg={props.pkg}
          setPkg={props.setPkg}
          addons={props.addons}
          setAddons={props.setAddons}
          formatPackageMeta={props.formatPackageMeta}
          t={props.t}
        />
      )}

      {activeStepKey === "datetime" && (
        <StepDateTime
          isInline={props.isInline}
          isCheckInFlow={props.isCheckInFlow}
          date={props.date}
          setDate={props.setDate}
          time={props.time}
          setTime={props.setTime}
          initialLoading={props.initialLoading}
          timeLoading={props.timeLoading}
          setTimeLoading={props.setTimeLoading}
          checkInScheduleNotice={props.checkInScheduleNotice}
          setCheckInScheduleNotice={props.setCheckInScheduleNotice}
          visibleTimeSlots={props.visibleTimeSlots}
          isSlotExpiredForCheckIn={props.isSlotExpiredForCheckIn}
          to12h={props.to12h}
          getCurrentCourseTimesForDate={props.getCurrentCourseTimesForDate}
          courseAvailableWeekdays={props.courseAvailableWeekdays}
          t={props.t}
        />
      )}

      {activeStepKey === "info" && (
        <EnrollInfoStep
          activeNumericField={props.activeNumericField}
          contact={props.contact}
          handleNumpadBackspace={props.handleNumpadBackspace}
          handleNumpadClear={props.handleNumpadClear}
          handleNumpadDigit={props.handleNumpadDigit}
          isCheckInFlow={props.isCheckInFlow}
          isKioskTerminalFlow={props.isKioskTerminalFlow}
          kioskInfoPhase={props.kioskInfoPhase}
          phoneTouched={props.phoneTouched}
          service={props.service}
          setActiveNumericField={props.setActiveNumericField}
          setContact={props.setContact}
          setExistingAccountDetected={props.setExistingAccountDetected}
          setPendingAutoPay={props.setPendingAutoPay}
          setPhoneTouched={props.setPhoneTouched}
          setRequiresSignIn={props.setRequiresSignIn}
          setResumeAfterSignInStep={props.setResumeAfterSignInStep}
          setKioskInfoPhase={props.setKioskInfoPhase}
          shouldMaskKioskInfoContent={props.shouldMaskKioskInfoContent}
          t={props.t}
          usesPhasedInfoForm={props.usesPhasedInfoForm}
        />
      )}

      {activeStepKey === "photo" && (
        <StepPhoto
          isCheckInFlow={props.isCheckInFlow}
          isQrMobileCompactFlow={props.isQrMobileCompactFlow}
          isCheckInNewFlow={props.isCheckInNewFlow}
          isKioskTerminalFlow={props.isKioskTerminalFlow}
          skipContactStep={props.skipContactStep}
          requiresPhotoStep={props.requiresPhotoStep}
          photoPolicy={props.photoPolicy}
          preparedAccount={props.preparedAccount}
          setPreparedAccount={props.setPreparedAccount}
          setPhotoSaved={props.setPhotoSaved}
          setFormError={props.setFormError}
          setStep={props.setStep}
          course={props.course}
          effectiveConsecutiveOffer={props.effectiveConsecutiveOffer}
        />
      )}

      {activeStepKey === "packages" && (
        <StepPackages
          isCheckInNewFlow={props.isCheckInNewFlow}
          isQrMobileCompactFlow={props.isQrMobileCompactFlow}
          course={props.course}
          pkg={props.pkg}
          setPkg={props.setPkg}
          to12h={props.to12h}
          time={props.time}
          formatPackageMeta={props.formatPackageMeta}
        />
      )}

      {activeStepKey === "promo" && (
        <StepPromo
          effectiveConsecutiveOffer={props.effectiveConsecutiveOffer}
          effectiveIsPackageHolder={props.effectiveIsPackageHolder}
          consecutiveAccepted={props.consecutiveAccepted}
          setConsecutiveAccepted={props.setConsecutiveAccepted}
          consecutiveChoiceMade={props.consecutiveChoiceMade}
          setConsecutiveChoiceMade={props.setConsecutiveChoiceMade}
          setConsecutiveAddedCents={props.setConsecutiveAddedCents}
          to12h={props.to12h}
        />
      )}

      {activeStepKey === "consecutive" && props.effectiveConsecutiveOffer && (
        <StepConsecutive
          effectiveConsecutiveOffer={props.effectiveConsecutiveOffer}
          effectiveIsPackageHolder={props.effectiveIsPackageHolder}
          consecutiveAccepted={props.consecutiveAccepted}
          setConsecutiveAccepted={props.setConsecutiveAccepted}
          consecutiveChoiceMade={props.consecutiveChoiceMade}
          setConsecutiveChoiceMade={props.setConsecutiveChoiceMade}
          setConsecutiveAddedCents={props.setConsecutiveAddedCents}
          to12h={props.to12h}
        />
      )}

      {activeStepKey === "payments" && (
        <StepPayments
          isCheckInFlow={props.isCheckInFlow}
          course={props.course}
          pkg={props.pkg}
          service={props.service}
          date={props.date}
          time={props.time}
          participants={props.participants}
          contact={props.contact}
          addons={props.addons}
          to12h={props.to12h}
          consecutiveAccepted={props.consecutiveAccepted}
          consecutiveAddedCents={props.consecutiveAddedCents}
          effectiveConsecutiveOffer={props.effectiveConsecutiveOffer}
          kioskQrCheckoutLocked={props.kioskQrCheckoutLocked}
          couponInput={props.couponInput}
          setCouponInput={props.setCouponInput}
          appliedCoupon={props.appliedCoupon}
          setAppliedCoupon={props.setAppliedCoupon}
          subtotal={props.subtotal}
          total={props.total}
          serviceOpt={props.serviceOpt}
          pkgOpt={props.pkgOpt}
          addonsOpts={props.addonsOpts}
          paymentMethod={props.paymentMethod}
          setPaymentMethod={props.setPaymentMethod}
          t={props.t}
        />
      )}

      {!props.isCheckInFlow && activeStepKey === "review" && (
        <StepReview
          course={props.course}
          service={props.service}
          pkg={props.pkg}
          addons={props.addons}
          participants={props.participants}
          date={props.date}
          time={props.time}
          contact={props.contact}
          paymentMethodLabel={props.paymentMethodLabel}
          total={props.total}
          pkgOpt={props.pkgOpt}
          to12h={props.to12h}
          t={props.t}
        />
      )}
    </>
  )
}
