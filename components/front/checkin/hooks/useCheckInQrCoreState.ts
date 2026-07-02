"use client"

import React from "react"
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation"
import { parseDuration } from "@/lib/checkin/checkin-helpers"
import { resolvePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import {
  resolveCheckInActiveContext,
  resolveCheckInBootstrapContextPayload,
} from "@/lib/checkin/checkin-bootstrap-context"
import {
  createEmptyKioskQrCheckoutState,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import type {
  EntryMode,
  BootstrapResponse,
  PackageOfferContext,
  CheckInQrClientProps,
} from "@/components/front/checkin/checkin.types"
import type { CourseData } from "@/constants/courses"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckInQrCoreState {
  // Search params (from next/navigation — passed through for consumers)
  searchParams: ReadonlyURLSearchParams

  // Clock / layout
  internalNowTick: Date
  setInternalNowTick: React.Dispatch<React.SetStateAction<Date>>
  nowTick: Date
  origin: string
  setOrigin: React.Dispatch<React.SetStateAction<string>>
  isCompactViewport: boolean
  setIsCompactViewport: React.Dispatch<React.SetStateAction<boolean>>
  durationMinutes: number

  // Entry flow
  mode: EntryMode
  setMode: React.Dispatch<React.SetStateAction<EntryMode>>
  openNewBooking: boolean
  setOpenNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  newBookingOverride: { courseSlug: string; date: string; time: string } | null
  setNewBookingOverride: React.Dispatch<React.SetStateAction<{ courseSlug: string; date: string; time: string } | null>>
  latePaymentEntryOverride: { courseSlug: string; date: string; time: string } | null
  setLatePaymentEntryOverride: React.Dispatch<React.SetStateAction<{ courseSlug: string; date: string; time: string } | null>>

  // Phone / sign-in
  showPhoneSignIn: boolean
  setShowPhoneSignIn: React.Dispatch<React.SetStateAction<boolean>>
  pendingLoginPhone: string
  setPendingLoginPhone: React.Dispatch<React.SetStateAction<string>>

  // Existing booking
  existingRegularBookingOverride: { courseSlug: string; date: string; time: string } | null
  setExistingRegularBookingOverride: React.Dispatch<React.SetStateAction<{ courseSlug: string; date: string; time: string } | null>>
  existingRegularBookingKey: number
  setExistingRegularBookingKey: React.Dispatch<React.SetStateAction<number>>

  // Consecutive payment gate
  awaitingConsecutivePaymentSelection: boolean
  setAwaitingConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>

  // Modals / processing
  paymentsModalReady: boolean
  setPaymentsModalReady: React.Dispatch<React.SetStateAction<boolean>>
  processingPackageCheckIn: boolean
  setProcessingPackageCheckIn: React.Dispatch<React.SetStateAction<boolean>>

  // Feedback
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  success: string | null
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>

  // Purchase
  showDuplicatePurchasePopup: boolean
  setShowDuplicatePurchasePopup: React.Dispatch<React.SetStateAction<boolean>>
  packageOfferContext: PackageOfferContext
  setPackageOfferContext: React.Dispatch<React.SetStateAction<PackageOfferContext>>
  packageOfferSelectedId: string | null
  setPackageOfferSelectedId: React.Dispatch<React.SetStateAction<string | null>>

  // New-student return flag
  returnedFromNewStudentFlow: boolean
  setReturnedFromNewStudentFlow: React.Dispatch<React.SetStateAction<boolean>>

  // Consecutive QR checkout
  consecutiveQrCheckout: KioskQrCheckoutState
  setConsecutiveQrCheckout: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>

  // Derived / memoised context
  preDisplayActiveContext: ReturnType<typeof resolveCheckInActiveContext>
  contextPayload: ReturnType<typeof resolveCheckInBootstrapContextPayload>
  visibleError: string | null
  isQrEntry: boolean
  photoFlowContext: ReturnType<typeof resolvePhotoFlowContext>
  isKioskTerminalFlow: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Owns all primitive state, memoised derived values, and context resolution
 * for the CheckIn QR controller. No sub-hooks or side-effects live here.
 */
export function useCheckInQrCoreState({
  sourceCourses,
  shellVariant = "qr",
  forcedCourseSlug,
  forcedClassContext,
  selectedCourseSlug,
  terminalTodayOnly,
  simulatedNowTick,
}: {
  sourceCourses: CourseData[]
  shellVariant: CheckInQrClientProps["shellVariant"]
  forcedCourseSlug: string
  forcedClassContext: CheckInQrClientProps["forcedClassContext"]
  selectedCourseSlug?: string
  terminalTodayOnly?: boolean
  simulatedNowTick?: Date
}): CheckInQrCoreState {
  const searchParams = useSearchParams()

  // ─── Clock / layout ──────────────────────────────────────────
  const [internalNowTick, setInternalNowTick] = React.useState<Date>(() => new Date())
  const nowTick = simulatedNowTick ?? internalNowTick
  const [origin, setOrigin] = React.useState("")
  const [isCompactViewport, setIsCompactViewport] = React.useState(false)
  const durationMinutes = parseDuration(searchParams.get("durationMinutes"))

  // ─── Entry flow ──────────────────────────────────────────────
  const [mode, setMode] = React.useState<EntryMode>("idle")
  const [openNewBooking, setOpenNewBooking] = React.useState(false)
  const [newBookingOverride, setNewBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [latePaymentEntryOverride, setLatePaymentEntryOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)

  // ─── Phone / sign-in ─────────────────────────────────────────
  const [showPhoneSignIn, setShowPhoneSignIn] = React.useState(false)
  const [pendingLoginPhone, setPendingLoginPhone] = React.useState("")

  // ─── Existing booking ─────────────────────────────────────────
  const [existingRegularBookingOverride, setExistingRegularBookingOverride] = React.useState<{
    courseSlug: string
    date: string
    time: string
  } | null>(null)
  const [existingRegularBookingKey, setExistingRegularBookingKey] = React.useState(0)

  // ─── Consecutive payment gate ────────────────────────────────
  // When the user accepts a consecutive offer pre-check-in with a positive
  // price, we first show the package success overlay (credit consumed,
  // remaining credits) and wait for the operator/student to press "Done"
  // before opening the Cash/Card payment selection for class B. This flag
  // tells the Done handler to advance to payment selection instead of
  // resetting the station.
  const [awaitingConsecutivePaymentSelection, setAwaitingConsecutivePaymentSelection] = React.useState(false)

  // ─── Modals / processing ─────────────────────────────────────
  const [paymentsModalReady, setPaymentsModalReady] = React.useState(false)
  const [processingPackageCheckIn, setProcessingPackageCheckIn] = React.useState(false)

  // ─── Feedback ────────────────────────────────────────────────
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [showDuplicatePurchasePopup, setShowDuplicatePurchasePopup] = React.useState(false)

  // ─── Purchase ────────────────────────────────────────────────
  const [packageOfferContext, setPackageOfferContext] = React.useState<PackageOfferContext>(null)
  const [packageOfferSelectedId, setPackageOfferSelectedId] = React.useState<string | null>(null)
  const [returnedFromNewStudentFlow, setReturnedFromNewStudentFlow] = React.useState(false)

  // ─── Consecutive QR checkout state ──────────────────────────
  const [consecutiveQrCheckout, setConsecutiveQrCheckout] = React.useState<KioskQrCheckoutState>(
    createEmptyKioskQrCheckoutState()
  )

  // ─── Derived context ─────────────────────────────────────────
  const preDisplayActiveContext = React.useMemo(
    () =>
      resolveCheckInActiveContext({
        sourceCourses,
        shellVariant,
        searchParams,
        forcedCourseSlug,
        forcedClassContext,
        selectedCourseSlug,
        nowTick,
        terminalTodayOnly,
      }),
    [forcedClassContext, forcedCourseSlug, nowTick, searchParams, selectedCourseSlug, shellVariant, sourceCourses, terminalTodayOnly]
  )

  const contextPayload = React.useMemo(
    () =>
      resolveCheckInBootstrapContextPayload({
        activeCourseSlug: preDisplayActiveContext.activeCourseSlug,
        activeDate: preDisplayActiveContext.activeDate,
        activeTime: preDisplayActiveContext.activeTime,
        durationMinutes,
        latePaymentEntryOverride,
      }),
    [durationMinutes, latePaymentEntryOverride, preDisplayActiveContext.activeCourseSlug, preDisplayActiveContext.activeDate, preDisplayActiveContext.activeTime]
  )

  // ─── Derived error ───────────────────────────────────────────
  const visibleError = React.useMemo(() => {
    if (!error) return null
    const normalized = error.trim().toLowerCase()
    if (
      normalized.includes("we couldn't prepare the fast flow") ||
      normalized.includes("we couldn't load the fast flow")
    ) {
      return null
    }
    return error
  }, [error])

  // ─── QR / photo flow flags ───────────────────────────────────
  const isQrEntry = React.useMemo(() => {
    const qrView = (searchParams.get("fromQr") || searchParams.get("scan") || "").trim().toLowerCase()
    return qrView === "1" || qrView === "true"
  }, [searchParams])

  const photoFlowContext = React.useMemo(
    () => resolvePhotoFlowContext({ shellVariant, isQrEntry }),
    [isQrEntry, shellVariant]
  )
  const isKioskTerminalFlow = photoFlowContext === "kiosk_terminal"

  return {
    searchParams,
    internalNowTick,
    setInternalNowTick,
    nowTick,
    origin,
    setOrigin,
    isCompactViewport,
    setIsCompactViewport,
    durationMinutes,
    mode,
    setMode,
    openNewBooking,
    setOpenNewBooking,
    newBookingOverride,
    setNewBookingOverride,
    latePaymentEntryOverride,
    setLatePaymentEntryOverride,
    showPhoneSignIn,
    setShowPhoneSignIn,
    pendingLoginPhone,
    setPendingLoginPhone,
    existingRegularBookingOverride,
    setExistingRegularBookingOverride,
    existingRegularBookingKey,
    setExistingRegularBookingKey,
    awaitingConsecutivePaymentSelection,
    setAwaitingConsecutivePaymentSelection,
    paymentsModalReady,
    setPaymentsModalReady,
    processingPackageCheckIn,
    setProcessingPackageCheckIn,
    error,
    setError,
    success,
    setSuccess,
    showDuplicatePurchasePopup,
    setShowDuplicatePurchasePopup,
    packageOfferContext,
    setPackageOfferContext,
    packageOfferSelectedId,
    setPackageOfferSelectedId,
    returnedFromNewStudentFlow,
    setReturnedFromNewStudentFlow,
    consecutiveQrCheckout,
    setConsecutiveQrCheckout,
    preDisplayActiveContext,
    contextPayload,
    visibleError,
    isQrEntry,
    photoFlowContext,
    isKioskTerminalFlow,
  }
}
