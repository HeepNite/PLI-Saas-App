"use client"

import React from "react"
import { TERMINAL_CHARGE_POLL_MS, isTerminalChargeFinal, type TerminalChargeItemInput, type TerminalChargeView } from "@/lib/terminal-charges/contract"

export class TerminalChargeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Calls a staff terminal-charge endpoint; a failed call throws with the server's own reason. */
const chargeRequest = async (path: string, fallbackError: string, init?: RequestInit): Promise<TerminalChargeView> => {
  const response = await fetch(`/api/staff/terminal-charges${path}`, { cache: "no-store", ...init })
  const payload = (await response.json().catch(() => ({}))) as { charge?: TerminalChargeView; error?: string }
  if (!response.ok || !payload.charge) throw new TerminalChargeApiError(payload.error || fallbackError, response.status)
  return payload.charge
}

export const createTerminalCharge = (body: { terminalId: string; payerUserId: string; items: TerminalChargeItemInput[] }) =>
  chargeRequest("", "Unable to send the charge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

export const UNREACHABLE_SERVER_MESSAGE = "Can't reach the server — retrying…"
export const STATUS_POLL_MAX_DELAY_MS = 15_000
const FAILURES_BEFORE_WARNING = 3
// The charge is gone or no longer ours to read: retrying cannot help.
const UNRECOVERABLE_POLL_STATUSES = new Set([401, 403, 404])

// Tracks one sent charge: polls until it reaches a final status (backing off on failures, stopping
// on 401/403/404), exposes cancel, ticks a clock while pending (countdown) and fires onPaid once.
export const useTerminalChargeStatus = (onPaid: () => void) => {
  const [charge, setCharge] = React.useState<TerminalChargeView | null>(null)
  const [pollFailures, setPollFailures] = React.useState(0)
  const [loadErrorStatus, setLoadErrorStatus] = React.useState<number | null>(null)
  const [cancelError, setCancelError] = React.useState<string | null>(null)
  const [cancelling, setCancelling] = React.useState(false)
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const onPaidRef = React.useRef(onPaid)
  onPaidRef.current = onPaid

  const chargeId = charge?.id ?? null
  const status = charge?.status ?? null
  const isFinal = status !== null && isTerminalChargeFinal(status)

  React.useEffect(() => {
    if (!chargeId || isFinal || loadErrorStatus !== null) return
    let cancelled = false
    const delay = Math.min(TERMINAL_CHARGE_POLL_MS * 2 ** pollFailures, STATUS_POLL_MAX_DELAY_MS)
    const timer = setTimeout(async () => {
      try {
        const next = await chargeRequest(`/${encodeURIComponent(chargeId)}`, "Unable to load the charge")
        if (cancelled) return
        setPollFailures(0)
        setCharge(next)
      } catch (error) {
        if (cancelled) return
        if (error instanceof TerminalChargeApiError && UNRECOVERABLE_POLL_STATUSES.has(error.status)) setLoadErrorStatus(error.status)
        else setPollFailures((failures) => failures + 1) // re-arms the poll with a longer delay
      }
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [chargeId, isFinal, charge, pollFailures, loadErrorStatus])

  React.useEffect(() => {
    if (status !== "pending") return
    setNowMs(Date.now())
    const interval = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  // `status` reaches "paid" once per tracked charge, so the board refreshes exactly once.
  React.useEffect(() => {
    if (status === "paid") onPaidRef.current()
  }, [status])

  const cancel = async () => {
    if (!chargeId) return
    setCancelling(true)
    setCancelError(null)
    try {
      setCharge(await chargeRequest(`/${encodeURIComponent(chargeId)}/cancel`, "Payment in progress, can't cancel now", { method: "POST" }))
    } catch (error) {
      // The server says why (e.g. "Payment received, finishing up", "Card is being processed").
      setCancelError(error instanceof Error ? error.message : "Unable to cancel the charge")
    } finally {
      setCancelling(false)
    }
  }

  const pollMessage = loadErrorStatus !== null
    ? `This charge can't be loaded (${loadErrorStatus})`
    : pollFailures >= FAILURES_BEFORE_WARNING ? UNREACHABLE_SERVER_MESSAGE : null

  return { charge, track: setCharge, cancel, cancelling, cancelError, pollMessage, nowMs, isFinal }
}
