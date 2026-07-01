"use client"
import React from "react"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import { type EnrollmentOption } from "@/constants/courses"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { Building2, CreditCard } from "lucide-react"
import type { Coupon, EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import type { CourseEnrollmentData } from "@/components/front/courses/types"
import ProfilePhotoCapture from "@/components/front/checkin/ProfilePhotoCapture"
import { resolveEnrollStepKeys } from "@/lib/checkin/enroll-flow"
import type { PhotoPolicy } from "@/lib/checkin/photo-context-policy"
import { formatEnrollmentOptionPrice } from "@/components/front/courses/utils/package-pricing"
import EnrollInfoStep from "./EnrollInfoStep"
import type { KioskInfoPhase } from "../model/kiosk-info-phase"
import type { PreparedAccountState } from "../types/enroll-modal-props"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import type { I18nKey } from "@/lib/i18n-dict"

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
  const {
    activeStepKey,
    isInline,
    isCheckInFlow,
    isCheckInNewFlow,
    isQrMobileCompactFlow,
    isKioskTerminalFlow,
    isNewStudent,
    isCheckInExistingFlow,
    isProfileBookingFlow,
    skipContactStep,
    availableServices,
    hasNewStudentService,
    course,
    courseAvailableWeekdays,
    service,
    setService,
    participants,
    setParticipants,
    pkg,
    setPkg,
    addons,
    setAddons,
    contact,
    setContact,
    date,
    setDate,
    time,
    setTime,
    initialLoading,
    timeLoading,
    setTimeLoading,
    checkInScheduleNotice,
    setCheckInScheduleNotice,
    visibleTimeSlots,
    isSlotExpiredForCheckIn,
    to12h,
    getCurrentCourseTimesForDate,
    photoPolicy,
    preparedAccount,
    setPreparedAccount,
    setPhotoSaved,
    setFormError,
    requiresPhotoStep,
    step,
    steps,
    stepKeys,
    setStep,
    photoStepIndex,
    effectiveConsecutiveOffer,
    effectiveIsPackageHolder,
    consecutiveAccepted,
    setConsecutiveAccepted,
    consecutiveChoiceMade,
    setConsecutiveChoiceMade,
    consecutiveAddedCents,
    setConsecutiveAddedCents,
    kioskQrCheckoutLocked,
    couponInput,
    setCouponInput,
    appliedCoupon,
    setAppliedCoupon,
    subtotal,
    total,
    serviceOpt,
    pkgOpt,
    addonsOpts,
    paymentMethod,
    setPaymentMethod,
    paymentMethodLabel,
    formatPackageMeta,
    activeNumericField,
    handleNumpadBackspace,
    handleNumpadClear,
    handleNumpadDigit,
    kioskInfoPhase,
    phoneTouched,
    setActiveNumericField,
    setExistingAccountDetected,
    setPendingAutoPay,
    setPhoneTouched,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setKioskInfoPhase,
    shouldMaskKioskInfoContent,
    usesPhasedInfoForm,
    t,
  } = props

  const toggleAddon = (id: string) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <>
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
                onChange={(e) => setParticipants(parseInt(e.target.value) || 1)}
                disabled={isNewStudent}
                className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 disabled:opacity-60"
              >
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? t("onePerson") : t("manyPeople")}</option>)}
              </select>
              {isNewStudent && (
                <p className="text-xs text-neutral-500">{t("new_student_single_notice")}</p>
              )}
            </fieldset>
          </div>

          {!!course.enrollment.packages.length && (
            <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t("optionalPackages")}</h4>
                {pkg && (
                  <button type="button" onClick={() => setPkg("")} className="text-xs underline">
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
                timezone={isCheckInFlow ? "America/New_York" : undefined}
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
          contact={contact}
          handleNumpadBackspace={handleNumpadBackspace}
          handleNumpadClear={handleNumpadClear}
          handleNumpadDigit={handleNumpadDigit}
          isCheckInFlow={isCheckInFlow}
          isKioskTerminalFlow={isKioskTerminalFlow}
          kioskInfoPhase={kioskInfoPhase}
          phoneTouched={phoneTouched}
          service={service}
          setActiveNumericField={setActiveNumericField}
          setContact={setContact}
          setExistingAccountDetected={setExistingAccountDetected}
          setPendingAutoPay={setPendingAutoPay}
          setPhoneTouched={setPhoneTouched}
          setRequiresSignIn={setRequiresSignIn}
          setResumeAfterSignInStep={setResumeAfterSignInStep}
          setKioskInfoPhase={setKioskInfoPhase}
          shouldMaskKioskInfoContent={shouldMaskKioskInfoContent}
          t={t}
          usesPhasedInfoForm={usesPhasedInfoForm}
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

      {activeStepKey === "packages" && (
        <div className="space-y-4">
          <div className={`grid gap-2.5 ${course.enrollment.packages.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
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
                  className={`relative min-h-[7rem] w-full overflow-hidden rounded-[1.1rem] border px-3.5 py-3.5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${isLastOddPackage ? "col-span-2" : ""} ${packageCardBackground} ${
                    selected
                      ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
                      : "border-white/14 hover:border-white/24 hover:brightness-110"
                  }`}
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
                  <div className="relative flex h-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold uppercase tracking-[-0.01em] text-white leading-tight">{p.label}</p>
                      {p.price != null && (
                        <p className="shrink-0 text-right text-lg font-semibold text-white">{formatEnrollmentOptionPrice(p.price)}</p>
                      )}
                    </div>
                    {descriptionLine && (
                      <p className="w-full text-xs leading-snug text-white/68 line-clamp-2">{descriptionLine}</p>
                    )}
                    {shouldShowMetaLine && (
                      <p className="mt-auto w-full text-[11px] text-white/48">{metaLine}</p>
                    )}
                  </div>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPkg("")}
              className={`relative min-h-[7rem] w-full overflow-hidden rounded-[1.1rem] border px-3.5 py-3.5 text-left shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)] transition ${course.enrollment.packages.length > 1 ? "col-span-2" : ""} bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(182,22,22,0.22),transparent_36%),linear-gradient(145deg,rgba(38,40,52,0.96),rgba(17,19,28,0.98))] ${
                !pkg
                  ? "border-[rgba(220,38,38,0.72)] ring-2 ring-[rgba(182,22,22,0.38)]"
                  : "border-white/14 hover:border-white/24 hover:brightness-110"
              }`}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
              <div className="relative flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[-0.01em] text-white">Drop-in</p>
                    <p className="mt-0.5 text-[11px] text-white/50">{course.title} / {to12h(time)}</p>
                  </div>
                  <p className="shrink-0 text-right text-lg font-semibold text-white">${(isCheckInNewFlow || isQrMobileCompactFlow) ? "15" : "20"}</p>
                </div>
                <p className="w-full text-xs leading-snug text-white/68">
                  {isCheckInNewFlow ? "First-time student single class." : "Single class without a package."}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

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
          <div className="relative overflow-hidden rounded-[1.15rem] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(182,22,22,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%),linear-gradient(145deg,rgba(44,45,55,0.96),rgba(19,20,27,0.99))] p-4 text-white shadow-[0_22px_50px_-34px_rgba(0,0,0,0.9)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden />
            <div className="relative space-y-4">
              {isCheckInFlow && (
                <>
                  <div>
                    <div className="text-sm font-semibold text-white">{t("reviewAndConfirm")}</div>
                    <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-white/68 sm:grid-cols-2">
                      <div>{t("course")}: <span className="text-white">{course.title}</span></div>
                      <div>{t("service")}: <span className="text-white">{course.enrollment.services.find((s) => s.id === service)?.label}{pkgOpt ? " (included in package)" : ""}</span></div>
                      <div>{t("dateTime")}: <span className="text-white">{date} {to12h(time)}</span></div>
                      <div>{t("people")}: <span className="text-white">{participants}</span></div>
                      <div>{t("name")}: <span className="text-white">{`${contact.firstName} ${contact.lastName}`.trim() || "—"}</span></div>
                      <div>{t("email")}: <span className="text-white">{contact.email || "—"}</span></div>
                      <div>Phone: <span className="text-white">{contact.phone || "—"}</span></div>
                      {!!addons.length && (
                        <div>{t("extras")}: <span className="text-white">{addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</span></div>
                      )}
                      {pkg && (
                        <div>{t("package")}: <span className="text-white">{course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</span></div>
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
                      {course.title}{time ? ` · ${to12h(time)}` : ""} — {course.enrollment.services.find((s) => s.id === service)?.label}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                      {date && <span>Date: {date}{time ? ` · ${to12h(time)}` : ""}</span>}
                      {course.location?.address && <span>Address: {course.location.address}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/58">
                      <span>{participants} {participants === 1 ? t("onePerson") : t("manyPeople")}</span>
                      <span>Service: {serviceOpt?.label || "—"}{pkgOpt ? " (included)" : ""}</span>
                      {pkgOpt && <span>Package: {pkgOpt.label}</span>}
                      {!!addonsOpts.length && <span>Extras: {addonsOpts.map((a) => a.label).join(", ")}</span>}
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

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="text-sm font-medium shrink-0" htmlFor="coupon">{t("payments_coupon")}</label>
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={t("payments_coupon_placeholder")}
                  disabled={kioskQrCheckoutLocked}
                  className="min-w-0 flex-1 rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    disabled={kioskQrCheckoutLocked}
                    onClick={() => { setAppliedCoupon(null); setCouponInput("") }}
                    className="shrink-0 rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                  >
                    {t("payments_remove")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={kioskQrCheckoutLocked}
                    onClick={() => {
                      const code = couponInput.trim().toUpperCase()
                      if (code === "PLI10") setAppliedCoupon({ code, type: "percent", value: 10 })
                      else if (code === "PLI20") setAppliedCoupon({ code, type: "percent", value: 20 })
                      else if (!code) return
                      else alert(t("payments_invalidCoupon"))
                    }}
                    className="shrink-0 rounded-md bg-[var(--brand,#111)] text-white px-3 py-2 text-sm"
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
                onClick={() => setPaymentMethod("onsite")}
                className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod === "onsite" ? "border-[var(--brand,#111)] bg-[var(--brand,#111)]/5" : "border-black/10 dark:border-white/10"}`}
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
                onClick={() => setPaymentMethod("stripe")}
                className={`rounded-md border px-4 py-4 text-sm text-left ${paymentMethod === "stripe" ? "border-[var(--brand,#111)] bg-[var(--brand,#111)]/5" : "border-black/10 dark:border-white/10"}`}
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
              <div>{t("service")}: {course.enrollment.services.find((s) => s.id === service)?.label}{pkgOpt ? " (included in package)" : ""}</div>
              <div>{t("package")}: {course.enrollment.packages.find((p) => p.id === pkg)?.label || "—"}</div>
              {!!addons.length && <div>{t("extras")}: {addons.map((a) => course.enrollment.addons?.find((x) => x.id === a)?.label).filter(Boolean).join(", ")}</div>}
              <div>{t("people")}: {participants}</div>
              <div>{t("dateTime")}: {date} {to12h(time)}</div>
              <div>{t("name")}: {`${contact.firstName} ${contact.lastName}`.trim() || "—"}</div>
              <div>{t("email")}: {contact.email || "—"}</div>
              <div>Phone: {contact.phone || "—"}</div>
              <div>{t("paymentMethod")}: {paymentMethodLabel}</div>
              {contact.note && <div>{t("notes")}: {contact.note}</div>}
              <div className="pt-2">{t("estimatedTotal")}: <span className="font-semibold">${total.toFixed(2)}</span> <span className="opacity-60">({t("demo")})</span></div>
            </div>
          </GlassyCard>
        </div>
      )}
    </>
  )
}
