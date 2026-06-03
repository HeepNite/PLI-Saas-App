import React from "react"

import { requestPackageCheckInApi } from "@/lib/checkin/checkin-qr-api"
import { resolvePackageSuccessDoneAction } from "@/lib/checkin/existing-customer-flow"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

export type PackageCheckInResult = {
  attendanceId?: string | null
  remainingCredits: number | null
  points: number
}

type RequestPackageCheckIn = typeof requestPackageCheckInApi

type UseCheckInPackageFlowOptions = {
  bootstrap: BootstrapResponse | null
  getToken: (options: { skipCache: boolean }) => Promise<string | null>
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  effectiveCheckInWindowOpen: boolean
  photoFlowContext: string
  isKioskTerminalFlow: boolean
  setProcessingPackageCheckIn: (value: boolean) => void
  awaitingConsecutivePaymentSelection: boolean
  setError: (value: string | null) => void
  setSuccess: (value: string | null) => void
  loadBootstrap: () => Promise<void>
  checkConsecutiveOfferAfterCheckIn: () => Promise<boolean>
  handleStationCompletion: () => void | Promise<void>
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  requestPackageCheckIn?: RequestPackageCheckIn
}

export function useCheckInPackageFlow({
  bootstrap,
  getToken,
  hasActiveClerkSession,
  kioskPinSessionToken,
  effectiveCheckInWindowOpen,
  photoFlowContext,
  isKioskTerminalFlow,
  setProcessingPackageCheckIn,
  awaitingConsecutivePaymentSelection,
  setError,
  setSuccess,
  loadBootstrap,
  checkConsecutiveOfferAfterCheckIn,
  handleStationCompletion,
  setAwaitingConsecutivePaymentSelection,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  requestPackageCheckIn = requestPackageCheckInApi,
}: UseCheckInPackageFlowOptions) {
  const [packageCheckInResult, setPackageCheckInResult] = React.useState<PackageCheckInResult | null>(null)
  const packageCheckInTimeoutRef = React.useRef<number | null>(null)

  const clearPackageCheckInTimeout = React.useCallback(() => {
    if (packageCheckInTimeoutRef.current !== null) {
      window.clearTimeout(packageCheckInTimeoutRef.current)
      packageCheckInTimeoutRef.current = null
    }
  }, [])

  const completeStationPackageFlow = React.useCallback(() => {
    clearPackageCheckInTimeout()
    void handleStationCompletion()
    setPackageCheckInResult(null)
  }, [clearPackageCheckInTimeout, handleStationCompletion])

  const performPackageCheckInApi = React.useCallback(async (): Promise<PackageCheckInResult | null> => {
    if (!bootstrap) return null
    if (!hasActiveClerkSession && !kioskPinSessionToken) return null
    if (!bootstrap.package) return null
    if (!effectiveCheckInWindowOpen) return null

    try {
      const token = await getToken({ skipCache: true })
      const { res, data } = await requestPackageCheckIn({
        token,
        payload: {
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
          durationMinutes: bootstrap.context.durationMinutes,
          flowContext: photoFlowContext,
          ...(!hasActiveClerkSession && kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        },
      })
      if (!res.ok) return null

      return {
        remainingCredits: data?.package && typeof data.package.remainingCredits === "number" ? data.package.remainingCredits : null,
        attendanceId: typeof data?.attendance?.id === "string" ? data.attendance.id : null,
        points: typeof data?.points?.awarded === "number" ? data.points.awarded : 0,
      }
    } catch {
      return null
    }
  }, [bootstrap, effectiveCheckInWindowOpen, getToken, hasActiveClerkSession, kioskPinSessionToken, photoFlowContext, requestPackageCheckIn])

  const handlePackageCheckIn = React.useCallback(async () => {
    if (!bootstrap) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) return setError("Sign in first to complete package check-in.")
    if (!bootstrap.package) return setError("No active package available for this class.")
    if (!effectiveCheckInWindowOpen) return setError("The check-in window for this class is closed.")

    setProcessingPackageCheckIn(true)
    setError(null)
    setSuccess(null)

    const result = await performPackageCheckInApi()
    if (!result) {
      setError("Unable to check in with package.")
      setProcessingPackageCheckIn(false)
      return
    }

    if (isKioskTerminalFlow) {
      clearPackageCheckInTimeout()
      setPackageCheckInResult(result)
      packageCheckInTimeoutRef.current = window.setTimeout(() => {
        packageCheckInTimeoutRef.current = null
        void checkConsecutiveOfferAfterCheckIn()
      }, 2500)
      setProcessingPackageCheckIn(false)
      return
    }

    const successParts = ["Package check-in completed."]
    if (result.remainingCredits !== null) successParts.push(`Remaining credits: ${result.remainingCredits}.`)
    if (result.points > 0) successParts.push(`Points earned: +${result.points}.`)
    setSuccess(successParts.join(" "))
    await loadBootstrap()
    setProcessingPackageCheckIn(false)
  }, [bootstrap, checkConsecutiveOfferAfterCheckIn, clearPackageCheckInTimeout, effectiveCheckInWindowOpen, hasActiveClerkSession, isKioskTerminalFlow, kioskPinSessionToken, loadBootstrap, performPackageCheckInApi, setError, setProcessingPackageCheckIn, setSuccess])

  const handlePackageSuccessDone = React.useCallback(() => {
    const action = resolvePackageSuccessDoneAction({ awaitingConsecutivePaymentSelection })
    if (action === "open-payment-selection") {
      clearPackageCheckInTimeout()
      setAwaitingConsecutivePaymentSelection(false)
      setPackageCheckInResult(null)
      setShowConsecutiveOverlay(true)
      setShowConsecutivePaymentSelection(true)
      return
    }
    completeStationPackageFlow()
  }, [awaitingConsecutivePaymentSelection, clearPackageCheckInTimeout, completeStationPackageFlow, setAwaitingConsecutivePaymentSelection, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  React.useEffect(() => clearPackageCheckInTimeout, [clearPackageCheckInTimeout])

  return {
    packageCheckInResult,
    setPackageCheckInResult,
    performPackageCheckInApi,
    handlePackageCheckIn,
    handlePackageSuccessDone,
  }
}
