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
  newBookingOverride: SlotOverride | null
  setNewBookingOverride: React.Dispatch<React.SetStateAction<SlotOverride | null>>
  latePaymentEntryOverride: SlotOverride | null
  setLatePaymentEntryOverride: React.Dispatch<React.SetStateAction<SlotOverride | null>>

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

// ─── Clock / Layout Reducer ───────────────────────────────────────────────────

type SlotOverride = { courseSlug: string; date: string; time: string; durationMinutes?: number }

interface ClockLayoutState {
  internalNowTick: Date
  origin: string
  isCompactViewport: boolean
}

type ClockLayoutAction =
  | { type: "SET_NOW_TICK"; payload: Date | ((prev: Date) => Date) }
  | { type: "SET_ORIGIN"; payload: string | ((prev: string) => string) }
  | { type: "SET_IS_COMPACT_VIEWPORT"; payload: boolean | ((prev: boolean) => boolean) }

function clockLayoutReducer(state: ClockLayoutState, action: ClockLayoutAction): ClockLayoutState {
  switch (action.type) {
    case "SET_NOW_TICK":
      return {
        ...state,
        internalNowTick:
          typeof action.payload === "function"
            ? action.payload(state.internalNowTick)
            : action.payload,
      }
    case "SET_ORIGIN":
      return {
        ...state,
        origin:
          typeof action.payload === "function"
            ? action.payload(state.origin)
            : action.payload,
      }
    case "SET_IS_COMPACT_VIEWPORT":
      return {
        ...state,
        isCompactViewport:
          typeof action.payload === "function"
            ? action.payload(state.isCompactViewport)
            : action.payload,
      }
    default:
      return state
  }
}

// ─── Check-In Reducer ─────────────────────────────────────────────────────────

interface CheckInState {
  // Entry flow
  mode: EntryMode
  openNewBooking: boolean
  newBookingOverride: SlotOverride | null
  latePaymentEntryOverride: SlotOverride | null
  // Phone / sign-in
  showPhoneSignIn: boolean
  pendingLoginPhone: string
  // Existing booking
  existingRegularBookingOverride: SlotOverride | null
  existingRegularBookingKey: number
  // Consecutive payment gate
  awaitingConsecutivePaymentSelection: boolean
  // Modals / processing
  paymentsModalReady: boolean
  processingPackageCheckIn: boolean
  // Feedback
  error: string | null
  success: string | null
  showDuplicatePurchasePopup: boolean
  // Purchase
  packageOfferContext: PackageOfferContext
  packageOfferSelectedId: string | null
  returnedFromNewStudentFlow: boolean
  // Consecutive QR checkout
  consecutiveQrCheckout: KioskQrCheckoutState
}

type CheckInAction =
  | { type: "SET_MODE"; payload: EntryMode | ((prev: EntryMode) => EntryMode) }
  | { type: "SET_OPEN_NEW_BOOKING"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_NEW_BOOKING_OVERRIDE"; payload: SlotOverride | null | ((prev: SlotOverride | null) => SlotOverride | null) }
  | { type: "SET_LATE_PAYMENT_ENTRY_OVERRIDE"; payload: SlotOverride | null | ((prev: SlotOverride | null) => SlotOverride | null) }
  | { type: "SET_SHOW_PHONE_SIGN_IN"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_PENDING_LOGIN_PHONE"; payload: string | ((prev: string) => string) }
  | { type: "SET_EXISTING_REGULAR_BOOKING_OVERRIDE"; payload: SlotOverride | null | ((prev: SlotOverride | null) => SlotOverride | null) }
  | { type: "SET_EXISTING_REGULAR_BOOKING_KEY"; payload: number | ((prev: number) => number) }
  | { type: "SET_AWAITING_CONSECUTIVE_PAYMENT_SELECTION"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_PAYMENTS_MODAL_READY"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_PROCESSING_PACKAGE_CHECK_IN"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_ERROR"; payload: string | null | ((prev: string | null) => string | null) }
  | { type: "SET_SUCCESS"; payload: string | null | ((prev: string | null) => string | null) }
  | { type: "SET_SHOW_DUPLICATE_PURCHASE_POPUP"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_PACKAGE_OFFER_CONTEXT"; payload: PackageOfferContext | ((prev: PackageOfferContext) => PackageOfferContext) }
  | { type: "SET_PACKAGE_OFFER_SELECTED_ID"; payload: string | null | ((prev: string | null) => string | null) }
  | { type: "SET_RETURNED_FROM_NEW_STUDENT_FLOW"; payload: boolean | ((prev: boolean) => boolean) }
  | { type: "SET_CONSECUTIVE_QR_CHECKOUT"; payload: KioskQrCheckoutState | ((prev: KioskQrCheckoutState) => KioskQrCheckoutState) }

function applyFn<T>(value: T | ((prev: T) => T), prev: T): T {
  return typeof value === "function" ? (value as (prev: T) => T)(prev) : value
}

function checkInReducer(state: CheckInState, action: CheckInAction): CheckInState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: applyFn(action.payload, state.mode) }
    case "SET_OPEN_NEW_BOOKING":
      return { ...state, openNewBooking: applyFn(action.payload, state.openNewBooking) }
    case "SET_NEW_BOOKING_OVERRIDE":
      return { ...state, newBookingOverride: applyFn(action.payload, state.newBookingOverride) }
    case "SET_LATE_PAYMENT_ENTRY_OVERRIDE":
      return { ...state, latePaymentEntryOverride: applyFn(action.payload, state.latePaymentEntryOverride) }
    case "SET_SHOW_PHONE_SIGN_IN":
      return { ...state, showPhoneSignIn: applyFn(action.payload, state.showPhoneSignIn) }
    case "SET_PENDING_LOGIN_PHONE":
      return { ...state, pendingLoginPhone: applyFn(action.payload, state.pendingLoginPhone) }
    case "SET_EXISTING_REGULAR_BOOKING_OVERRIDE":
      return { ...state, existingRegularBookingOverride: applyFn(action.payload, state.existingRegularBookingOverride) }
    case "SET_EXISTING_REGULAR_BOOKING_KEY":
      return { ...state, existingRegularBookingKey: applyFn(action.payload, state.existingRegularBookingKey) }
    case "SET_AWAITING_CONSECUTIVE_PAYMENT_SELECTION":
      return { ...state, awaitingConsecutivePaymentSelection: applyFn(action.payload, state.awaitingConsecutivePaymentSelection) }
    case "SET_PAYMENTS_MODAL_READY":
      return { ...state, paymentsModalReady: applyFn(action.payload, state.paymentsModalReady) }
    case "SET_PROCESSING_PACKAGE_CHECK_IN":
      return { ...state, processingPackageCheckIn: applyFn(action.payload, state.processingPackageCheckIn) }
    case "SET_ERROR":
      return { ...state, error: applyFn(action.payload, state.error) }
    case "SET_SUCCESS":
      return { ...state, success: applyFn(action.payload, state.success) }
    case "SET_SHOW_DUPLICATE_PURCHASE_POPUP":
      return { ...state, showDuplicatePurchasePopup: applyFn(action.payload, state.showDuplicatePurchasePopup) }
    case "SET_PACKAGE_OFFER_CONTEXT":
      return { ...state, packageOfferContext: applyFn(action.payload, state.packageOfferContext) }
    case "SET_PACKAGE_OFFER_SELECTED_ID":
      return { ...state, packageOfferSelectedId: applyFn(action.payload, state.packageOfferSelectedId) }
    case "SET_RETURNED_FROM_NEW_STUDENT_FLOW":
      return { ...state, returnedFromNewStudentFlow: applyFn(action.payload, state.returnedFromNewStudentFlow) }
    case "SET_CONSECUTIVE_QR_CHECKOUT":
      return { ...state, consecutiveQrCheckout: applyFn(action.payload, state.consecutiveQrCheckout) }
    default:
      return state
  }
}

// ─── Initial states ───────────────────────────────────────────────────────────

const initialClockLayoutState: ClockLayoutState = {
  internalNowTick: new Date(),
  origin: "",
  isCompactViewport: false,
}

function createInitialCheckInState(): CheckInState {
  return {
    mode: "idle",
    openNewBooking: false,
    newBookingOverride: null,
    latePaymentEntryOverride: null,
    showPhoneSignIn: false,
    pendingLoginPhone: "",
    existingRegularBookingOverride: null,
    existingRegularBookingKey: 0,
    awaitingConsecutivePaymentSelection: false,
    paymentsModalReady: false,
    processingPackageCheckIn: false,
    error: null,
    success: null,
    showDuplicatePurchasePopup: false,
    packageOfferContext: null,
    packageOfferSelectedId: null,
    returnedFromNewStudentFlow: false,
    consecutiveQrCheckout: createEmptyKioskQrCheckoutState(),
  }
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
  const [clockLayout, dispatchClockLayout] = React.useReducer(
    clockLayoutReducer,
    initialClockLayoutState,
    () => ({ ...initialClockLayoutState, internalNowTick: new Date() })
  )

  // ─── Check-in state ──────────────────────────────────────────
  const [checkIn, dispatchCheckIn] = React.useReducer(
    checkInReducer,
    undefined,
    createInitialCheckInState
  )

  const nowTick = simulatedNowTick ?? clockLayout.internalNowTick
  const durationMinutes = forcedClassContext?.durationMinutes ?? parseDuration(searchParams.get("durationMinutes"))

  // ─── Setters: clock / layout ─────────────────────────────────
  const setInternalNowTick = React.useCallback<React.Dispatch<React.SetStateAction<Date>>>(
    (value) => dispatchClockLayout({ type: "SET_NOW_TICK", payload: value }),
    []
  )
  const setOrigin = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (value) => dispatchClockLayout({ type: "SET_ORIGIN", payload: value }),
    []
  )
  const setIsCompactViewport = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchClockLayout({ type: "SET_IS_COMPACT_VIEWPORT", payload: value }),
    []
  )

  // ─── Setters: check-in ───────────────────────────────────────
  const setMode = React.useCallback<React.Dispatch<React.SetStateAction<EntryMode>>>(
    (value) => dispatchCheckIn({ type: "SET_MODE", payload: value }),
    []
  )
  const setOpenNewBooking = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_OPEN_NEW_BOOKING", payload: value }),
    []
  )
  const setNewBookingOverride = React.useCallback<React.Dispatch<React.SetStateAction<SlotOverride | null>>>(
    (value) => dispatchCheckIn({ type: "SET_NEW_BOOKING_OVERRIDE", payload: value }),
    []
  )
  const setLatePaymentEntryOverride = React.useCallback<React.Dispatch<React.SetStateAction<SlotOverride | null>>>(
    (value) => dispatchCheckIn({ type: "SET_LATE_PAYMENT_ENTRY_OVERRIDE", payload: value }),
    []
  )
  const setShowPhoneSignIn = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_SHOW_PHONE_SIGN_IN", payload: value }),
    []
  )
  const setPendingLoginPhone = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (value) => dispatchCheckIn({ type: "SET_PENDING_LOGIN_PHONE", payload: value }),
    []
  )
  const setExistingRegularBookingOverride = React.useCallback<React.Dispatch<React.SetStateAction<SlotOverride | null>>>(
    (value) => dispatchCheckIn({ type: "SET_EXISTING_REGULAR_BOOKING_OVERRIDE", payload: value }),
    []
  )
  const setExistingRegularBookingKey = React.useCallback<React.Dispatch<React.SetStateAction<number>>>(
    (value) => dispatchCheckIn({ type: "SET_EXISTING_REGULAR_BOOKING_KEY", payload: value }),
    []
  )
  const setAwaitingConsecutivePaymentSelection = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_AWAITING_CONSECUTIVE_PAYMENT_SELECTION", payload: value }),
    []
  )
  const setPaymentsModalReady = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_PAYMENTS_MODAL_READY", payload: value }),
    []
  )
  const setProcessingPackageCheckIn = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_PROCESSING_PACKAGE_CHECK_IN", payload: value }),
    []
  )
  const setError = React.useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
    (value) => dispatchCheckIn({ type: "SET_ERROR", payload: value }),
    []
  )
  const setSuccess = React.useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
    (value) => dispatchCheckIn({ type: "SET_SUCCESS", payload: value }),
    []
  )
  const setShowDuplicatePurchasePopup = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_SHOW_DUPLICATE_PURCHASE_POPUP", payload: value }),
    []
  )
  const setPackageOfferContext = React.useCallback<React.Dispatch<React.SetStateAction<PackageOfferContext>>>(
    (value) => dispatchCheckIn({ type: "SET_PACKAGE_OFFER_CONTEXT", payload: value }),
    []
  )
  const setPackageOfferSelectedId = React.useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
    (value) => dispatchCheckIn({ type: "SET_PACKAGE_OFFER_SELECTED_ID", payload: value }),
    []
  )
  const setReturnedFromNewStudentFlow = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => dispatchCheckIn({ type: "SET_RETURNED_FROM_NEW_STUDENT_FLOW", payload: value }),
    []
  )
  const setConsecutiveQrCheckout = React.useCallback<React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>>(
    (value) => dispatchCheckIn({ type: "SET_CONSECUTIVE_QR_CHECKOUT", payload: value }),
    []
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
        latePaymentEntryOverride: checkIn.latePaymentEntryOverride,
      }),
    [durationMinutes, checkIn.latePaymentEntryOverride, preDisplayActiveContext.activeCourseSlug, preDisplayActiveContext.activeDate, preDisplayActiveContext.activeTime]
  )

  // ─── Derived error ───────────────────────────────────────────
  const visibleError = React.useMemo(() => {
    if (!checkIn.error) return null
    const normalized = checkIn.error.trim().toLowerCase()
    if (
      normalized.includes("we couldn't prepare the fast flow") ||
      normalized.includes("we couldn't load the fast flow")
    ) {
      return null
    }
    return checkIn.error
  }, [checkIn.error])

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
    internalNowTick: clockLayout.internalNowTick,
    setInternalNowTick,
    nowTick,
    origin: clockLayout.origin,
    setOrigin,
    isCompactViewport: clockLayout.isCompactViewport,
    setIsCompactViewport,
    durationMinutes,
    mode: checkIn.mode,
    setMode,
    openNewBooking: checkIn.openNewBooking,
    setOpenNewBooking,
    newBookingOverride: checkIn.newBookingOverride,
    setNewBookingOverride,
    latePaymentEntryOverride: checkIn.latePaymentEntryOverride,
    setLatePaymentEntryOverride,
    showPhoneSignIn: checkIn.showPhoneSignIn,
    setShowPhoneSignIn,
    pendingLoginPhone: checkIn.pendingLoginPhone,
    setPendingLoginPhone,
    existingRegularBookingOverride: checkIn.existingRegularBookingOverride,
    setExistingRegularBookingOverride,
    existingRegularBookingKey: checkIn.existingRegularBookingKey,
    setExistingRegularBookingKey,
    awaitingConsecutivePaymentSelection: checkIn.awaitingConsecutivePaymentSelection,
    setAwaitingConsecutivePaymentSelection,
    paymentsModalReady: checkIn.paymentsModalReady,
    setPaymentsModalReady,
    processingPackageCheckIn: checkIn.processingPackageCheckIn,
    setProcessingPackageCheckIn,
    error: checkIn.error,
    setError,
    success: checkIn.success,
    setSuccess,
    showDuplicatePurchasePopup: checkIn.showDuplicatePurchasePopup,
    setShowDuplicatePurchasePopup,
    packageOfferContext: checkIn.packageOfferContext,
    setPackageOfferContext,
    packageOfferSelectedId: checkIn.packageOfferSelectedId,
    setPackageOfferSelectedId,
    returnedFromNewStudentFlow: checkIn.returnedFromNewStudentFlow,
    setReturnedFromNewStudentFlow,
    consecutiveQrCheckout: checkIn.consecutiveQrCheckout,
    setConsecutiveQrCheckout,
    preDisplayActiveContext,
    contextPayload,
    visibleError,
    isQrEntry,
    photoFlowContext,
    isKioskTerminalFlow,
  }
}
