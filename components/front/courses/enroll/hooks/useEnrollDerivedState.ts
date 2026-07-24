"use client"
import React from "react"
import {
  Calendar as CalendarIcon,
  CalendarCheck,
  Camera,
  CreditCard,
  Building2,
  User,
  FileText,
  CheckCircle2,
} from "lucide-react"
import type { CourseData, EnrollmentOption } from "@/constants/courses"
import type { Coupon, EnrollmentContact, PaymentMethod, CourseEnrollmentData } from "@/components/front/courses/types"
import { useI18n } from "@/lib/i18n"
import { getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { buildEnrollCalendarLinks } from "@/components/front/courses/enroll/model/enroll-calendar"
import { calculateEnrollPricing } from "@/components/front/courses/enroll/model/enroll-pricing"
import { resolveFlowStepKeys } from "@/components/front/courses/enroll/model/enroll-selectors"
import { resolveAvailableEnrollServices } from "@/components/front/courses/enroll/model/enroll-services"
import { resolveEnrollInitialStep, getCheckInSignInModalVariant } from "@/lib/checkin/enroll-flow"
import { getKioskPaymentTransitionMessage } from "@/lib/checkin/kiosk-qr-payment"
import { isRegularFallbackLocked } from "@/lib/checkin/new-student-flow"
import { formatUSPhone } from "@/components/front/courses/utils/phone"
import { formatCheckInSummaryDateTime } from "@/components/front/courses/enroll/model/checkin-autofill"

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/
const CHECKIN_TIME_ZONE = "America/New_York"
const CHECKIN_LATE_GRACE_MINUTES = 20

function toMinutes(time24: string): number | null {
  if (!TIME_24_REGEX.test(time24)) return null
  const [hour, minute] = time24.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function sortTime24(values: string[]): string[] {
  return [...new Set(values.filter((value) => TIME_24_REGEX.test(value)))].sort(
    (a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0)
  )
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return ISO_DATE_REGEX.test(trimmed) ? trimmed : ""
}

export type UseEnrollDerivedStateInput = {
  course: CourseEnrollmentData
  sourceCourses: CourseData[]
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isCheckInExistingFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow: boolean
  isProfileBookingFlow: boolean
  skipContactStep: boolean
  initialStep: number | undefined
  newStudentFallbackPhoneKey: string | null
  contact: EnrollmentContact
  service: string
  pkg: string
  addons: string[]
  participants: number
  date: string
  time: string
  appliedCoupon: Coupon
  consecutiveAccepted: boolean
  consecutiveAddedCents: number
  effectiveConsecutiveOffer: unknown
  requiresPhotoStep: boolean
  photoSaved: boolean
  consecutiveChoiceMade: boolean
  consecutiveOfferLoading: boolean
  paymentMethod: PaymentMethod
  checkInNow: Date
  user?: {
    firstName?: string | null
    lastName?: string | null
    primaryPhoneNumber?: { phoneNumber: string } | null
    phoneNumbers?: Array<{ phoneNumber: string }>
    primaryEmailAddress?: { emailAddress: string } | null
  } | null
}

export function useEnrollDerivedState(input: UseEnrollDerivedStateInput) {
  const { t } = useI18n()
  const {
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
  } = input

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

  const regularServiceId = React.useMemo(
    () =>
      availableServices.find((item) => item.id !== "new-student")?.id ||
      availableServices[0]?.id ||
      "",
    [availableServices]
  )

  const stepKeys = React.useMemo(
    () =>
      resolveFlowStepKeys({
        isCheckInFlow,
        isQrMobileCompactFlow,
        isCheckInNewFlow,
        isKioskTerminalFlow,
        requiresPhotoStep,
        skipInfoStep: skipContactStep,
        hasPackages: course.enrollment.packages.length > 0,
        hasConsecutiveOffer: Boolean(
          effectiveConsecutiveOffer &&
            typeof effectiveConsecutiveOffer === "object" &&
            (effectiveConsecutiveOffer as { linkedCourseSlug?: string }).linkedCourseSlug
        ),
        isProfileBookingFlow,
      }),
    [isCheckInFlow, isQrMobileCompactFlow, isCheckInNewFlow, isKioskTerminalFlow, requiresPhotoStep, skipContactStep, course.enrollment.packages.length, effectiveConsecutiveOffer, isProfileBookingFlow]
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

  const currentUserContact = React.useMemo<Partial<EnrollmentContact>>(() => {
    const userPhone = user?.primaryPhoneNumber?.phoneNumber || user?.phoneNumbers?.[0]?.phoneNumber
    return {
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

  const calendarLinks = React.useMemo(
    () =>
      buildEnrollCalendarLinks({
        course,
        serviceLabel: course.enrollment.services.find((s) => s.id === service)?.label || "",
        participants,
        total: pricing.total,
        date,
        time,
        classWord: t("classWord"),
        googleDetails: t("googleCal_details", { participants, total: pricing.total.toFixed(2) }),
        icsDescription: t("ics_description", { participants, total: pricing.total.toFixed(2) }),
      }),
    [course, date, participants, service, t, time, pricing.total]
  )

  const checkInTodayIso = React.useMemo(
    () => getDateKeyInTimeZone(checkInNow, CHECKIN_TIME_ZONE),
    [checkInNow]
  )

  const checkInNowMinutes = React.useMemo(
    () => toMinutes(getTimeKeyInTimeZone(checkInNow, CHECKIN_TIME_ZONE)),
    [checkInNow]
  )

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

  const formattedSummaryDateTime = React.useMemo(
    () => formatCheckInSummaryDateTime(date, time),
    [date, time]
  )

  const stepValidCtx = {
    steps,
    participants,
    availableServices,
    service,
    date,
    time,
    consecutiveOfferLoading,
    contact,
    requiresPhotoStep,
    photoSaved,
    consecutiveChoiceMade,
    paymentMethod,
  }

  return {
    availableServices,
    hasNewStudentService,
    courseAvailableWeekdays,
    regularServiceId,
    stepKeys,
    steps,
    stepIcons,
    paymentsStepIndex,
    infoStepIndex,
    photoStepIndex,
    packagesStepIndex,
    regularServicePrice,
    regularFallbackLocked,
    effectiveInitialStep,
    signInModalVariant,
    kioskPaymentTransitionMessage,
    currentUserContact,
    pricing,
    calendarLinks,
    checkInTodayIso,
    checkInNowMinutes,
    getCurrentCourseTimesForDate,
    TIME_SLOTS_24,
    visibleTimeSlots,
    isSlotExpiredForCheckIn,
    formattedSummaryDateTime,
    stepValidCtx,
    t,
  }
}
