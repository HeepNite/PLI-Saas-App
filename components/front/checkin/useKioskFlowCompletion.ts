"use client"

import React from "react"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"
import type { ConsecutiveOffer, PackageOfferContext } from "@/components/front/checkin/checkin.types"
import type { PackageCheckInFailure } from "@/lib/checkin/existing-customer-flow"

type EntryMode = "idle" | "existing" | "new"

type CheckInContextOverride = {
  courseSlug: string
  date: string
  time: string
}

type UseKioskFlowCompletionParams<TBootstrap> = {
  isKioskTerminalFlow: boolean
  resetKioskCustomerSession: () => void
  setBootstrap: React.Dispatch<React.SetStateAction<TBootstrap | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setExistingRegularBookingOverride: React.Dispatch<React.SetStateAction<CheckInContextOverride | null>>
  setKioskPin: React.Dispatch<React.SetStateAction<string>>
  setKioskPinAttemptsRemaining: React.Dispatch<React.SetStateAction<number | null>>
  setKioskPinBlockedUntil: React.Dispatch<React.SetStateAction<string | null>>
  setKioskPinConfirm: React.Dispatch<React.SetStateAction<string>>
  setKioskPinNext: React.Dispatch<React.SetStateAction<string>>
  setKioskPinRotationMode: (value: unknown) => void
  setKioskPinRotationRequired: (value: boolean | ((prev: boolean) => boolean)) => void
  setKioskPinSessionToken: React.Dispatch<React.SetStateAction<string>>
  setMode: React.Dispatch<React.SetStateAction<EntryMode>>
  setNewBookingOverride: React.Dispatch<React.SetStateAction<CheckInContextOverride | null>>
  setLatePaymentEntryOverride: React.Dispatch<React.SetStateAction<CheckInContextOverride | null>>
  setOpenNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  setPaymentsModalReady: React.Dispatch<React.SetStateAction<boolean>>
  setPendingLoginPhone: React.Dispatch<React.SetStateAction<string>>
  setShowPhoneSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
  setPackageOfferContext: React.Dispatch<React.SetStateAction<PackageOfferContext>>
  setPackageOfferSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  setConsecutiveOffer: React.Dispatch<React.SetStateAction<ConsecutiveOffer | null>>
  setConsecutiveOfferSettled: React.Dispatch<React.SetStateAction<boolean>>
  refreshConsecutiveOffer: () => void
  setPackageCheckInResult: React.Dispatch<React.SetStateAction<{ attendanceId?: string | null; remainingCredits: number | null; points: number } | null>>
  setShowConsecutiveOverlay: React.Dispatch<React.SetStateAction<boolean>>
  setShowConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>
  setAwaitingConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>
  /** Clears the kiosk package check-in retry backoff timer + pending state. */
  clearPackageCheckInBackoff: () => void
  setPackageCheckInAttempts: React.Dispatch<React.SetStateAction<number>>
  setPackageCheckInFailure: React.Dispatch<React.SetStateAction<PackageCheckInFailure | null>>
}

export const useKioskFlowCompletion = <TBootstrap,>({
  isKioskTerminalFlow,
  resetKioskCustomerSession,
  setBootstrap,
  setError,
  setExistingRegularBookingOverride,
  setKioskPin,
  setKioskPinAttemptsRemaining,
  setKioskPinBlockedUntil,
  setKioskPinConfirm,
  setKioskPinNext,
  setKioskPinRotationMode,
  setKioskPinRotationRequired,
  setKioskPinSessionToken,
  setMode,
  setNewBookingOverride,
  setLatePaymentEntryOverride,
  setOpenNewBooking,
  setPaymentsModalReady,
  setPendingLoginPhone,
  setShowPhoneSignIn,
  setSuccess,
  setPackageOfferContext,
  setPackageOfferSelectedId,
  setConsecutiveOffer,
  setConsecutiveOfferSettled,
  refreshConsecutiveOffer,
  setPackageCheckInResult,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  setAwaitingConsecutivePaymentSelection,
  clearPackageCheckInBackoff,
  setPackageCheckInAttempts,
  setPackageCheckInFailure,
}: UseKioskFlowCompletionParams<TBootstrap>) => {
  const resetCustomerFlowState = React.useCallback(() => {
    // Cancel any pending retry backoff BEFORE zeroing attempts/failure —
    // order matters (see design's "Retry policy" decision).
    clearPackageCheckInBackoff()
    setPackageCheckInAttempts(0)
    setPackageCheckInFailure(null)
    setOpenNewBooking(false)
    setNewBookingOverride(null)
    setLatePaymentEntryOverride(null)
    setExistingRegularBookingOverride(null)
    setPaymentsModalReady(false)
    setMode("idle")
    setBootstrap(null)
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setError(null)
    setSuccess(null)
    setKioskPin("")
    setKioskPinSessionToken("")
    setKioskPinRotationRequired(false)
    setKioskPinRotationMode(null)
    setKioskPinNext("")
    setKioskPinConfirm("")
    setKioskPinAttemptsRemaining(null)
    setKioskPinBlockedUntil(null)
    resetKioskCustomerSession()
    setPackageOfferContext(null)
    setPackageOfferSelectedId(null)
    setConsecutiveOffer(null)
    setConsecutiveOfferSettled(false)
    refreshConsecutiveOffer()
    setPackageCheckInResult(null)
    setShowConsecutiveOverlay(false)
    setShowConsecutivePaymentSelection(false)
    setAwaitingConsecutivePaymentSelection(false)
  }, [
    clearPackageCheckInBackoff,
    resetKioskCustomerSession,
    setBootstrap,
    refreshConsecutiveOffer,
    setConsecutiveOffer,
    setConsecutiveOfferSettled,
    setError,
    setExistingRegularBookingOverride,
    setKioskPin,
    setKioskPinAttemptsRemaining,
    setKioskPinBlockedUntil,
    setKioskPinConfirm,
    setKioskPinNext,
    setKioskPinRotationMode,
    setKioskPinRotationRequired,
    setKioskPinSessionToken,
    setMode,
    setNewBookingOverride,
    setLatePaymentEntryOverride,
    setOpenNewBooking,
    setPackageCheckInAttempts,
    setPackageCheckInFailure,
    setPackageCheckInResult,
    setPackageOfferContext,
    setPackageOfferSelectedId,
    setPaymentsModalReady,
    setPendingLoginPhone,
    setShowConsecutiveOverlay,
    setShowConsecutivePaymentSelection,
    setAwaitingConsecutivePaymentSelection,
    setShowPhoneSignIn,
    setSuccess,
  ])

  const handleStationCompletion = React.useCallback(() => {
    // For kiosk terminal: just reset customer state, stay on the same page
    // NEVER sign out - staff session must remain active
    // NEVER redirect - kiosk stays on terminal page
    completeKioskCustomerFlow({
      resetCustomerState: resetCustomerFlowState,
      isKioskTerminalFlow,
    })
  }, [isKioskTerminalFlow, resetCustomerFlowState])

  const dismissExistingCustomer = React.useCallback(() => {
    if (isKioskTerminalFlow) {
      void handleStationCompletion()
      return
    }

    // Defense-in-depth: this branch does its own partial reset (not the
    // full resetCustomerFlowState) but must still clear any leftover kiosk
    // package check-in backoff/attempts/failure state — e.g. a shared
    // device or a future caller reusing this hook. Order matters: cancel
    // the backoff before zeroing attempts/failure.
    clearPackageCheckInBackoff()
    setPackageCheckInAttempts(0)
    setPackageCheckInFailure(null)
    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setMode("idle")
    setBootstrap(null)
    setError(null)
    setSuccess(null)
  }, [
    clearPackageCheckInBackoff,
    handleStationCompletion,
    isKioskTerminalFlow,
    setBootstrap,
    setError,
    setMode,
    setPackageCheckInAttempts,
    setPackageCheckInFailure,
    setPendingLoginPhone,
    setShowPhoneSignIn,
    setSuccess,
  ])

  return {
    dismissExistingCustomer,
    handleStationCompletion,
    resetCustomerFlowState,
  }
}
