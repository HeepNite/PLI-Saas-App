"use client"

import React from "react"
import type { KioskPinRotationMode } from "@/components/front/checkin/checkin-kiosk.types"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"
import type { ConsecutiveOffer, PackageOfferContext } from "@/components/front/checkin/checkin.types"

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
  setKioskPinRotationMode: React.Dispatch<React.SetStateAction<KioskPinRotationMode | null>>
  setKioskPinRotationRequired: React.Dispatch<React.SetStateAction<boolean>>
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
  setConsecutiveFetchKey: React.Dispatch<React.SetStateAction<number>>
  setPackageCheckInResult: React.Dispatch<React.SetStateAction<{ remainingCredits: number | null; points: number } | null>>
  setShowConsecutiveOverlay: React.Dispatch<React.SetStateAction<boolean>>
  setShowConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>
  setAwaitingConsecutivePaymentSelection: React.Dispatch<React.SetStateAction<boolean>>
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
  setConsecutiveFetchKey,
  setPackageCheckInResult,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  setAwaitingConsecutivePaymentSelection,
}: UseKioskFlowCompletionParams<TBootstrap>) => {
  const resetCustomerFlowState = React.useCallback(() => {
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
    setConsecutiveFetchKey((k) => k + 1)
    setPackageCheckInResult(null)
    setShowConsecutiveOverlay(false)
    setShowConsecutivePaymentSelection(false)
    setAwaitingConsecutivePaymentSelection(false)
  }, [
    resetKioskCustomerSession,
    setBootstrap,
    setConsecutiveFetchKey,
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

    setShowPhoneSignIn(false)
    setPendingLoginPhone("")
    setMode("idle")
    setBootstrap(null)
    setError(null)
    setSuccess(null)
  }, [
    handleStationCompletion,
    isKioskTerminalFlow,
    setBootstrap,
    setError,
    setMode,
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
