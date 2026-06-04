import React from "react"
import {
  getExistingCustomerInitialStep,
  resolveDuplicatePurchaseDoneAction,
} from "@/lib/checkin/existing-customer-flow"
import { pickEnrollPrefill } from "@/lib/checkin/package-offer-integration"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { CourseData } from "@/constants/courses"
import type { PhotoFlowContext } from "@/lib/checkin/photo-context-policy"

type BookingOverride = {
  courseSlug: string
  date: string
  time: string
} | null

type UseCheckInBookingModalFlowInput = {
  // Course / context data
  sourceCourses: CourseData[]
  selectedCourse: CourseData | null
  qrCourse: CourseData | null
  activeDate: string
  activeTime: string
  durationMinutes: number | null | undefined
  // Bootstrap / session data
  bootstrap: BootstrapResponse | null
  hasBootstrapPrefilledContact: boolean
  photoFlowContext: PhotoFlowContext
  isKioskTerminalFlow: boolean
  hasUsablePackageForCurrentClass: boolean
  // Package offer state
  packageOfferSelectedId: string | null
  // Consecutive offer state
  consecutiveOffer: ConsecutiveOffer | null
  // Setter callbacks (from parent state)
  setExistingRegularBookingKey: React.Dispatch<React.SetStateAction<number>>
  setExistingRegularBookingOverride: React.Dispatch<React.SetStateAction<BookingOverride>>
  setNewBookingOverride: React.Dispatch<React.SetStateAction<BookingOverride>>
  setOpenNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
  setPaymentsModalReady: React.Dispatch<React.SetStateAction<boolean>>
  setConsecutiveOffer: React.Dispatch<React.SetStateAction<ConsecutiveOffer | null>>
  setShowConsecutiveOverlay: React.Dispatch<React.SetStateAction<boolean>>
  setShowConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>
  setShowDuplicatePurchasePopup: React.Dispatch<React.SetStateAction<boolean>>
  // Stable callbacks
  handleStationCompletion: () => void | Promise<void>
  checkConsecutiveOfferAfterCheckIn: () => Promise<boolean>
  refreshConsecutiveOffer: () => void
  // Booking override state (read-only for derived values)
  newBookingOverride: BookingOverride
  existingRegularBookingOverride: BookingOverride
}

type UseCheckInBookingModalFlowResult = {
  // Derived booking course/context for new booking
  newBookingCourse: CourseData | null
  newBookingContext: { date: string; time: string; durationMinutes: number | undefined }
  // Derived booking course/context for existing booking
  existingRegularBookingCourse: CourseData | null
  existingRegularBookingContext: { date: string; time: string; durationMinutes: number | undefined }
  // Derived step / prefill
  existingRegularBookingInitialStep: number
  existingRegularBookingPrefill: ReturnType<typeof pickEnrollPrefill>
  // Utility: opens existing purchase flow
  openExistingPurchaseFlow: (context: { courseSlug: string; date: string; time: string }) => void
  // Handlers
  handleDuplicatePurchaseDone: () => void
  handleNewBookingClose: () => void
  handleExistingBookingClose: () => void
  handleExistingBookingCompleted: () => Promise<void>
}

export function useCheckInBookingModalFlow(
  input: UseCheckInBookingModalFlowInput,
): UseCheckInBookingModalFlowResult {
  const {
    sourceCourses,
    selectedCourse,
    qrCourse,
    activeDate,
    activeTime,
    durationMinutes,
    bootstrap,
    hasBootstrapPrefilledContact,
    photoFlowContext,
    isKioskTerminalFlow,
    hasUsablePackageForCurrentClass,
    packageOfferSelectedId,
    consecutiveOffer,
    setExistingRegularBookingKey,
    setExistingRegularBookingOverride,
    setNewBookingOverride,
    setOpenNewBooking,
    setError,
    setSuccess,
    setPaymentsModalReady,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setShowDuplicatePurchasePopup,
    handleStationCompletion,
    checkConsecutiveOfferAfterCheckIn,
    refreshConsecutiveOffer,
    newBookingOverride,
    existingRegularBookingOverride,
  } = input

  // ─── Booking contexts ─────────────────────────────────────────────────────

  const newBookingCourse = React.useMemo(
    () =>
      sourceCourses.find((course) => course.slug === (newBookingOverride?.courseSlug || "")) ||
      selectedCourse ||
      qrCourse,
    [newBookingOverride?.courseSlug, qrCourse, selectedCourse, sourceCourses],
  )

  const newBookingContext = React.useMemo(
    () => ({
      date: newBookingOverride?.date || activeDate,
      time: newBookingOverride?.time || activeTime,
      durationMinutes: durationMinutes ?? undefined,
    }),
    [activeDate, activeTime, durationMinutes, newBookingOverride?.date, newBookingOverride?.time],
  )

  const existingRegularBookingCourse = React.useMemo(() => {
    const baseCourse =
      sourceCourses.find((course) => course.slug === (existingRegularBookingOverride?.courseSlug || "")) ||
      selectedCourse ||
      qrCourse
    if (!baseCourse) return null
    const regularServices = baseCourse.enrollment.services.filter((item) => item.id !== "new-student")
    if (!regularServices.length) return baseCourse
    return {
      ...baseCourse,
      enrollment: {
        ...baseCourse.enrollment,
        services: regularServices,
      },
    }
  }, [existingRegularBookingOverride?.courseSlug, qrCourse, selectedCourse, sourceCourses])

  const existingRegularBookingContext = React.useMemo(
    () => ({
      date: existingRegularBookingOverride?.date || activeDate,
      time: existingRegularBookingOverride?.time || activeTime,
      durationMinutes: durationMinutes ?? undefined,
    }),
    [
      activeDate,
      activeTime,
      durationMinutes,
      existingRegularBookingOverride?.date,
      existingRegularBookingOverride?.time,
    ],
  )

  // ─── Derived step / prefill ──────────────────────────────────────────────

  const existingRegularBookingInitialStep = getExistingCustomerInitialStep({
    isKioskTerminalFlow,
    hasPrefilledContact: hasBootstrapPrefilledContact,
    requiresPhotoStep: !bootstrap?.customer.hasAvatar && photoFlowContext === "kiosk_terminal",
    hasPackages: (existingRegularBookingCourse?.enrollment.packages.length ?? 0) > 0,
    hasActivePackage: hasUsablePackageForCurrentClass,
  })

  const existingRegularBookingPrefill = pickEnrollPrefill({
    quickCheckout: bootstrap?.quickCheckout ?? null,
    selectedPackageId: packageOfferSelectedId,
  })

  // ─── Utility ─────────────────────────────────────────────────────────────

  const openExistingPurchaseFlow = React.useCallback(
    (context: { courseSlug: string; date: string; time: string }) => {
      setError(null)
      setSuccess(null)
      setPaymentsModalReady(false)
      setExistingRegularBookingKey((prev) => prev + 1)
      setExistingRegularBookingOverride(context)
    },
    [setError, setExistingRegularBookingKey, setExistingRegularBookingOverride, setPaymentsModalReady, setSuccess],
  )

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleDuplicatePurchaseDone = React.useCallback(() => {
    setShowDuplicatePurchasePopup(false)
    const offer = bootstrap?.consecutiveOffer || consecutiveOffer
    const action = resolveDuplicatePurchaseDoneAction({
      hasConsecutiveOffer: Boolean(offer),
      hasPackage: hasUsablePackageForCurrentClass,
    })
    if (action === "open-consecutive-overlay" && offer) {
      setConsecutiveOffer(offer)
      setShowConsecutivePaymentSelection(false)
      setShowConsecutiveOverlay(true)
      return
    }
    void handleStationCompletion()
  }, [
    bootstrap?.consecutiveOffer,
    consecutiveOffer,
    handleStationCompletion,
    hasUsablePackageForCurrentClass,
    setConsecutiveOffer,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setShowDuplicatePurchasePopup,
  ])

  const handleNewBookingClose = React.useCallback(() => {
    if (isKioskTerminalFlow) {
      void handleStationCompletion()
      return
    }
    setOpenNewBooking(false)
    setNewBookingOverride(null)
  }, [handleStationCompletion, isKioskTerminalFlow, setNewBookingOverride, setOpenNewBooking])

  const handleExistingBookingClose = React.useCallback(() => {
    if (isKioskTerminalFlow) {
      void handleStationCompletion()
      return
    }
    setExistingRegularBookingOverride(null)
  }, [handleStationCompletion, isKioskTerminalFlow, setExistingRegularBookingOverride])

  const handleExistingBookingCompleted = React.useCallback(async () => {
    setExistingRegularBookingOverride(null)
    if (hasUsablePackageForCurrentClass && consecutiveOffer) {
      setConsecutiveOffer(null)
      refreshConsecutiveOffer()
      void handleStationCompletion()
      return
    }
    const hasOffer = await checkConsecutiveOfferAfterCheckIn()
    if (!hasOffer) {
      refreshConsecutiveOffer()
      void handleStationCompletion()
    }
  }, [
    checkConsecutiveOfferAfterCheckIn,
    consecutiveOffer,
    handleStationCompletion,
    hasUsablePackageForCurrentClass,
    refreshConsecutiveOffer,
    setConsecutiveOffer,
    setExistingRegularBookingOverride,
  ])

  return {
    newBookingCourse,
    newBookingContext,
    existingRegularBookingCourse,
    existingRegularBookingContext,
    existingRegularBookingInitialStep,
    existingRegularBookingPrefill,
    openExistingPurchaseFlow,
    handleDuplicatePurchaseDone,
    handleNewBookingClose,
    handleExistingBookingClose,
    handleExistingBookingCompleted,
  }
}
