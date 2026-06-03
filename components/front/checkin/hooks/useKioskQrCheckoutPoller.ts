import React from "react"

import { requestCheckoutSessionStatusApi } from "@/lib/checkin/checkin-qr-api"
import {
  KIOSK_QR_POLL_INTERVAL_MS,
  isKioskQrPendingPhase,
  resolveKioskQrPhaseFromStatus,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"

type KioskQrStatusData = {
  status?: unknown
  awaitingWebhook?: unknown
  purchaseId?: unknown
  paymentStatus?: unknown
  error?: unknown
}

type UseKioskQrCheckoutPollerOptions = {
  checkoutState: KioskQrCheckoutState
  setCheckoutState: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>
  onComplete: () => void
  fetchStatus?: typeof requestCheckoutSessionStatusApi
  pollIntervalMs?: number
  completionDelayMs?: number
}

const readNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const readStringOrNull = (value: unknown) => (typeof value === "string" ? value : null)

const toStatusData = (data: unknown): KioskQrStatusData => {
  if (!data || typeof data !== "object") return {}
  return data as KioskQrStatusData
}

const resolveExpiredMessage = (data: KioskQrStatusData) =>
  readNonEmptyString(data.error) ?? "The hosted checkout session expired before payment completed."

const resolveRefreshErrorMessage = (data: KioskQrStatusData) =>
  readNonEmptyString(data.error) ?? "Unable to refresh checkout status."

export function useKioskQrCheckoutPoller({
  checkoutState,
  setCheckoutState,
  onComplete,
  fetchStatus = requestCheckoutSessionStatusApi,
  pollIntervalMs = KIOSK_QR_POLL_INTERVAL_MS,
  completionDelayMs = 800,
}: UseKioskQrCheckoutPollerOptions) {
  const sessionId = checkoutState.sessionId
  const pendingPhase = isKioskQrPendingPhase(checkoutState.phase)

  React.useEffect(() => {
    if (checkoutState.phase !== "complete") {
      return
    }

    const timeoutId = window.setTimeout(onComplete, completionDelayMs)
    return () => window.clearTimeout(timeoutId)
  }, [checkoutState.phase, completionDelayMs, onComplete])

  React.useEffect(() => {
    if (!sessionId || !pendingPhase) {
      return
    }

    let cancelled = false
    let pollTimeoutId: number | null = null

    const scheduleNextPoll = () => {
      if (cancelled) return
      pollTimeoutId = window.setTimeout(poll, pollIntervalMs)
    }

    const poll = async () => {
      try {
        const { res, data } = await fetchStatus({ sessionId })
        if (cancelled) return

        const statusData = toStatusData(data)
        const nextPhase = resolveKioskQrPhaseFromStatus(readNonEmptyString(statusData.status))

        if (nextPhase === "complete") {
          setCheckoutState((prev) => ({
            ...prev,
            phase: "complete",
            purchaseId: readStringOrNull(statusData.purchaseId),
            paymentStatus: readStringOrNull(statusData.paymentStatus),
          }))
          return
        }

        if (nextPhase === "expired") {
          setCheckoutState((prev) => ({
            ...prev,
            phase: "expired",
            awaitingWebhook: false,
            error: resolveExpiredMessage(statusData),
          }))
          return
        }

        if (!res.ok) {
          setCheckoutState((prev) => ({
            ...prev,
            phase: "error",
            awaitingWebhook: false,
            error: resolveRefreshErrorMessage(statusData),
          }))
          return
        }

        setCheckoutState((prev) => ({
          ...prev,
          phase: nextPhase,
          awaitingWebhook: Boolean(statusData.awaitingWebhook),
          purchaseId: readStringOrNull(statusData.purchaseId),
          paymentStatus: readStringOrNull(statusData.paymentStatus),
          error: null,
        }))
      } catch (error) {
        if (cancelled) return
        console.warn("Unable to poll consecutive checkout session status", error)
        setCheckoutState((prev) => ({
          ...prev,
          phase: "error",
          awaitingWebhook: false,
          error: "Unable to refresh checkout status.",
        }))
        return
      }

      scheduleNextPoll()
    }

    void poll()

    return () => {
      cancelled = true
      if (pollTimeoutId !== null) {
        window.clearTimeout(pollTimeoutId)
      }
    }
  }, [fetchStatus, pendingPhase, pollIntervalMs, sessionId, setCheckoutState])
}
