import { KIOSK_QR_POLL_INTERVAL_MS, resolveKioskQrPhaseFromStatus } from "@/lib/checkin/kiosk-qr-payment"

import { requestCheckoutSessionStatusApi } from "./checkout-api"

type KioskQrPollerState = {
  phase: ReturnType<typeof resolveKioskQrPhaseFromStatus>
  awaitingWebhook: boolean
  purchaseId: string | null
  paymentStatus: string | null
  error: string | null
}

type KioskQrPollerOutcome =
  | { type: "complete"; purchaseId: string | null; paymentStatus: string | null }
  | { type: "state"; state: KioskQrPollerState }
  | { type: "error"; error: unknown; message: string }

type KioskQrPollerOptions = {
  sessionId: string
  onOutcome: (outcome: KioskQrPollerOutcome) => void | Promise<void>
  fetchStatus?: typeof requestCheckoutSessionStatusApi
  setTimeoutImpl?: typeof globalThis.setTimeout
  clearTimeoutImpl?: typeof globalThis.clearTimeout
  pollIntervalMs?: number
}

type KioskQrStatusData = {
  status?: unknown
  awaitingWebhook?: unknown
  purchaseId?: unknown
  paymentStatus?: unknown
  error?: unknown
}

const readNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveExpiredMessage = (data: KioskQrStatusData) =>
  readNonEmptyString(data.error) ?? "The hosted checkout session expired before payment completed."

const resolveRefreshErrorMessage = (data: KioskQrStatusData) =>
  readNonEmptyString(data.error) ?? "Unable to refresh checkout status."

const toStatusData = (data: unknown): KioskQrStatusData => {
  if (!data || typeof data !== "object") return {}
  return data as KioskQrStatusData
}

export const createKioskQrPoller = ({
  sessionId,
  onOutcome,
  fetchStatus = requestCheckoutSessionStatusApi,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  pollIntervalMs = KIOSK_QR_POLL_INTERVAL_MS,
}: KioskQrPollerOptions) => {
  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeoutImpl> | null = null

  const scheduleNextPoll = () => {
    if (cancelled) return
    timeoutId = setTimeoutImpl(poll, pollIntervalMs)
  }

  const emit = async (outcome: KioskQrPollerOutcome) => {
    if (cancelled) return
    await onOutcome(outcome)
  }

  const poll = async () => {
    try {
      const { res, data } = await fetchStatus({ sessionId })
      if (cancelled) return

      const statusData = toStatusData(data)
      const nextPhase = resolveKioskQrPhaseFromStatus(
        typeof statusData.status === "string" ? statusData.status : null
      )

      if (nextPhase === "complete") {
        await emit({
          type: "complete",
          purchaseId: readNonEmptyString(statusData.purchaseId),
          paymentStatus: readNonEmptyString(statusData.paymentStatus),
        })
        return
      }

      if (nextPhase === "expired") {
        await emit({
          type: "state",
          state: {
            phase: "expired",
            awaitingWebhook: false,
            purchaseId: null,
            paymentStatus: null,
            error: resolveExpiredMessage(statusData),
          },
        })
        return
      }

      if (!res.ok) {
        await emit({
          type: "state",
          state: {
            phase: "error",
            awaitingWebhook: false,
            purchaseId: null,
            paymentStatus: null,
            error: resolveRefreshErrorMessage(statusData),
          },
        })
        return
      }

      await emit({
        type: "state",
        state: {
          phase: nextPhase,
          awaitingWebhook: Boolean(statusData.awaitingWebhook),
          purchaseId: readNonEmptyString(statusData.purchaseId),
          paymentStatus: readNonEmptyString(statusData.paymentStatus),
          error: null,
        },
      })
    } catch (error) {
      await emit({ type: "error", error, message: "Unable to refresh checkout status." })
      return
    }

    scheduleNextPoll()
  }

  void poll()

  return () => {
    cancelled = true
    if (timeoutId !== null) {
      clearTimeoutImpl(timeoutId)
    }
  }
}
