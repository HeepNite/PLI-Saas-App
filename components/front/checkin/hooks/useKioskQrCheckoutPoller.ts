import React from "react"

import { requestCheckoutSessionStatusApi } from "@/lib/checkin/checkin-qr-api"
import {
  KIOSK_QR_POLL_INTERVAL_MS,
  isKioskQrPendingPhase,
  type KioskQrCheckoutState,
} from "@/lib/checkin/kiosk-qr-payment"
import { applyKioskQrStatePatch, createKioskQrPoller } from "@/lib/checkin/kiosk-qr-poller"

type UseKioskQrCheckoutPollerOptions = {
  checkoutState: KioskQrCheckoutState
  setCheckoutState: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>
  onComplete: () => void
  fetchStatus?: typeof requestCheckoutSessionStatusApi
  pollIntervalMs?: number
  completionDelayMs?: number
}

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

    return createKioskQrPoller({
      sessionId,
      fetchStatus,
      pollIntervalMs,
      onOutcome: (outcome) => {
        if (outcome.type === "complete") {
          const { purchaseId, paymentStatus } = outcome
          setCheckoutState((prev) => ({ ...prev, phase: "complete", purchaseId, paymentStatus }))
          return
        }

        if (outcome.type === "error") {
          console.warn("Unable to poll consecutive checkout session status", outcome.error)
          setCheckoutState((prev) => ({ ...prev, phase: "error", awaitingWebhook: false, error: outcome.message }))
          return
        }

        setCheckoutState((prev) => applyKioskQrStatePatch(prev, outcome.state))
      },
    })
  }, [fetchStatus, pendingPhase, pollIntervalMs, sessionId, setCheckoutState])
}
