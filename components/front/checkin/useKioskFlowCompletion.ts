"use client"

import React from "react"
import type { KioskPinRotationMode } from "@/components/front/checkin/checkin-kiosk.types"
import { completeKioskCustomerFlow } from "@/lib/checkin/kiosk-reset"

type EntryMode = "idle" | "existing" | "new"

type CheckInContextOverride = {
  courseSlug: string
  date: string
  time: string
}

type UseKioskFlowCompletionParams<TBootstrap> = {
  isKioskTerminalFlow: boolean
  kioskClerkSessionId: string | null
  replaceUrl: (url: string) => Promise<unknown> | unknown
  resetKioskCustomerSession: () => void
  signOutKioskCustomerSession: (sessionId: string) => Promise<unknown> | unknown
  stationRedirectUrl: string
  suppressClerkSessionOnCompletion: () => void
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
  setOpenNewBooking: React.Dispatch<React.SetStateAction<boolean>>
  setPaymentsModalReady: React.Dispatch<React.SetStateAction<boolean>>
  setPendingLoginPhone: React.Dispatch<React.SetStateAction<string>>
  setShowPhoneSignIn: React.Dispatch<React.SetStateAction<boolean>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
}

export const useKioskFlowCompletion = <TBootstrap,>({
  isKioskTerminalFlow,
  kioskClerkSessionId,
  replaceUrl,
  resetKioskCustomerSession,
  signOutKioskCustomerSession,
  stationRedirectUrl,
  suppressClerkSessionOnCompletion,
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
  setOpenNewBooking,
  setPaymentsModalReady,
  setPendingLoginPhone,
  setShowPhoneSignIn,
  setSuccess,
}: UseKioskFlowCompletionParams<TBootstrap>) => {
  const resetCustomerFlowState = React.useCallback(() => {
    setOpenNewBooking(false)
    setNewBookingOverride(null)
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
  }, [
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
    setOpenNewBooking,
    setPaymentsModalReady,
    setPendingLoginPhone,
    setShowPhoneSignIn,
    setSuccess,
  ])

  const handleStationCompletion = React.useCallback(async () => {
    suppressClerkSessionOnCompletion()

    await completeKioskCustomerFlow({
      resetCustomerState: resetCustomerFlowState,
      isKioskTerminalFlow,
      resetUrl: stationRedirectUrl,
      replaceUrl,
      signOutCustomerSession: kioskClerkSessionId
        ? () => signOutKioskCustomerSession(kioskClerkSessionId)
        : undefined,
    })
  }, [
    isKioskTerminalFlow,
    kioskClerkSessionId,
    replaceUrl,
    resetCustomerFlowState,
    signOutKioskCustomerSession,
    stationRedirectUrl,
    suppressClerkSessionOnCompletion,
  ])

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
